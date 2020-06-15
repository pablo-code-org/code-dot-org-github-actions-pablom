# == Schema Information
#
# Table name: contact_rollups_raw
#
#  id              :integer          not null, primary key
#  email           :string(255)      not null
#  sources         :string(255)      not null
#  data            :json
#  data_updated_at :datetime         not null
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#

class ContactRollupsRaw < ApplicationRecord
  self.table_name = 'contact_rollups_raw'

  def self.extract_email_preferences
    query = get_extraction_query('email_preferences', 'email', ['opt_in'])
    ContactRollupsV2.execute_query_in_transaction(query)
  end

  def self.extract_parent_emails
    source_sql = <<~SQL
      SELECT parent_email, MAX(updated_at) AS updated_at
      FROM users
      WHERE parent_email > ''
      GROUP BY parent_email
    SQL
    query = get_extraction_query(source_sql, 'parent_email', [], true, 'dashboard.users.parent_email')
    ContactRollupsV2.execute_query_in_transaction(query)
  end

  def self.extract_users_and_geos
    # An user can have many user_geos records. user_geos records starts with only NULL
    # values until a cronjob runs, does IP-to-address lookup, and update them later.
    teacher_and_geo_query = <<~SQL
      SELECT
        t.email, t.id as user_id,
        ug.city, ug.state, ug.postal_code, ug.country,
        MAX(GREATEST(t.updated_at, IFNULL(ug.updated_at, t.updated_at))) as updated_at
      FROM (#{teacher_query('id, email, updated_at')}) AS t
      LEFT OUTER JOIN user_geos AS ug
      ON t.id = ug.user_id
      GROUP BY email, t.id, city, state, postal_code, country
    SQL

    extraction_query = get_extraction_query(
      teacher_and_geo_query,
      'email',
      %w(user_id city state postal_code country),
      true,
      'dashboard.users'
    )
    ContactRollupsV2.execute_query_in_transaction(extraction_query)
  end

  def self.extract_pd_enrollments
    enrollment_email_query = <<~SQL
      SELECT
        e.email,
        w.course,
        MAX(GREATEST(e.updated_at, IFNULL(w.updated_at, e.updated_at))) AS updated_at
      FROM pd_enrollments as e
      LEFT OUTER JOIN pd_workshops as w
      ON e.pd_workshop_id = w.id
      WHERE email > ''
      GROUP BY email, course
    SQL

    extraction_query = get_extraction_query(
      enrollment_email_query,
      'email',
      ['course'],
      true,
      'dashboard.pd_enrollments'
    )
    ContactRollupsV2.execute_query_in_transaction(extraction_query)
  end

  def self.extract_census_submissions
    submitter_query = <<~SQL
      SELECT submitter_email_address, submitter_role, MAX(updated_at) AS updated_at
      FROM census_submissions
      WHERE submitter_email_address > ''
      GROUP BY submitter_email_address, submitter_role
    SQL

    extraction_query = get_extraction_query(
      submitter_query,
      'submitter_email_address',
      ['submitter_role'],
      true,
      'dashboard.census_submissions'
    )
    ContactRollupsV2.execute_query_in_transaction(extraction_query)
  end

  def self.extract_school_geos
    school_geos_query = <<~SQL
      SELECT
        t.email,
        s.city, s.state, s.zip,
        MAX(GREATEST(s.updated_at, si.updated_at, t.updated_at)) AS updated_at
      FROM schools AS s
      INNER JOIN school_infos AS si
      ON s.id = si.school_id
      INNER JOIN (#{teacher_query('email, school_info_id, updated_at')}) AS t
      ON si.id = t.school_info_id
      GROUP BY email, city, state, zip
    SQL

    extraction_query = get_extraction_query(
      school_geos_query,
      'email',
      %w(city state zip),
      true,
      'dashboard.schools'
    )
    ContactRollupsV2.execute_query_in_transaction(extraction_query)
  end

  def self.extract_pegasus_forms
    forms_query = <<~SQL
      SELECT email, kind, data->>'$.role_s' as role, MAX(updated_at) as updated_at
      FROM #{CDO.pegasus_db_name}.forms
      GROUP BY email, kind, role
    SQL

    extraction_query = get_extraction_query(
      forms_query,
      'email',
      %w(kind role),
      true,
      'pegasus.forms'
    )
    ContactRollupsV2.execute_query_in_transaction(extraction_query)
  end

  def self.extract_pegasus_form_geos
    # TODO: how to run this method in Rails end-to-end tests? It reads from pegasus tables.
    form_geos_query = <<~SQL
      SELECT
        f.email,
        fg.city, fg.state, fg.postal_code, fg.country,
        MAX(fg.updated_at) AS updated_at
      FROM #{CDO.pegasus_db_name}.forms AS f
      INNER JOIN #{CDO.pegasus_db_name}.form_geos AS fg
      ON f.id = fg.form_id
      WHERE email > ''
      GROUP BY email, city, state, postal_code, country
    SQL

    extraction_query = get_extraction_query(
      form_geos_query,
      'email',
      %w(city state postal_code country),
      true,
      'pegasus.form_geos'
    )
    ContactRollupsV2.execute_query_in_transaction(extraction_query)
  end

  def self.extract_pegasus_contacts
    # pegasus.contacts contains emails collected from pegasus.forms and
    # dashboard.census_submissions (using +Poste2.create_recipient+ method).
    # Those emails are already extracted, we only care about +unsubscribed_at+ column here.
    #
    # @Note: pegasus.contacts has duplicate emails even though its migration says
    # email is unique. Thus, we still have to de-duplicate emails.
    contact_query = <<~SQL
      SELECT email, MAX(unsubscribed_at) AS unsubscribed_at, MAX(updated_at) AS updated_at
      FROM #{CDO.pegasus_db_name}.contacts
      WHERE email > '' AND unsubscribed_at IS NOT NULL
      GROUP BY email
    SQL

    extraction_query = get_extraction_query(
      contact_query,
      'email',
      ['unsubscribed_at'],
      true,
      'pegasus.contacts'
    )
    ContactRollupsV2.execute_query_in_transaction(extraction_query)
  end

  def self.teacher_query(columns = '*')
    # This query selects only teacher accounts from the users table
    # because we don't store student email addresses at all.
    <<-SQL
      SELECT #{columns}
      FROM users
      WHERE email > ''
    SQL
  end

  # @param source [String] Source from which we want to extract data (can be a dashboard table name, or subquery)
  # @param email_column [String] Column in source table we want to insert ino the email column
  # @param data_columns [Array] Columns we want reshaped into a single JSON object
  # @param source_is_subquery [Boolean] (default false) Set to true if source is a subquery, rather than a table name
  # @param source_name [String] (default nil) Name for source (non-nil if using a subquery)
  # @return [String] A SQL statement to extract and reshape data from the source table.
  def self.get_extraction_query(source, email_column, data_columns, source_is_subquery=false, source_name=nil)
    if source_name.nil? && source_is_subquery
      raise 'Source name required if source is a subquery'
    end

    source_name ||= "dashboard.#{source}"
    wrapped_source = source_is_subquery ? "(#{source}) AS subquery" : source

    <<~SQL
      INSERT INTO #{ContactRollupsRaw.table_name} (email, sources, data, data_updated_at, created_at, updated_at)
      SELECT
        #{email_column},
        '#{source_name}' AS sources,
        #{create_json_object(data_columns)} AS data,
        updated_at AS data_updated_at,
        NOW() AS created_at,
        NOW() AS updated_at
      FROM #{wrapped_source}
      WHERE #{email_column} IS NOT NULL AND #{email_column} != ''
    SQL
  end

  # Generates a string with the MySQL syntax used in a SELECT statement
  # to create a JSON object out of multiple database columns.
  # @example
  #   Input: ['age', 'name', 'email']
  #   Output: "JSON_OBJECT('age', age, 'name', name, 'email', email)"
  # @param columns [Array] Column names to reshape
  # @return [String] MySQL JSON_OBJECT() syntax for insertion
  def self.create_json_object(columns)
    return 'NULL' if columns.empty?

    'JSON_OBJECT(' + columns.map {|col| "'#{col}',#{col}"}.join(',') + ')'
  end
end
