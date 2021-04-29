class PopulateExistingSimpleSurveyForms < ActiveRecord::Migration[5.2]
  EXISTING_SIMPLE_SURVEY_FORMS = [
    {
      form_name: 'surveys/teachers/nps_survey',
      path: 'nps_survey',
      allow_multiple_submissions: false
    },
    {
      form_name: 'surveys/teachers/teacher_end_of_year_survey',
      path: 'csf_post_course',
      survey_data: {course: 'CS Fundamentals', pd: false},
      allow_multiple_submissions: false
    },
    {
      form_name: 'surveys/teachers/teacher_end_of_year_survey',
      path: 'csf_post_course_pd',
      survey_data: {course: 'CS Fundamentals', pd: true},
      allow_multiple_submissions: false
    },
    {
      form_name: 'surveys/teachers/teacher_end_of_year_survey',
      path: 'csd_post_course',
      survey_data: {course: 'CS Discoveries', pd: false},
      allow_multiple_submissions: false
    },
    {
      form_name: 'surveys/teachers/teacher_end_of_year_survey',
      path: 'csd_post_course_pd',
      survey_data: {course: 'CS Discoveries', pd: true},
      allow_multiple_submissions: false
    },
    {
      form_name: 'surveys/teachers/teacher_end_of_year_survey',
      path: 'csp_post_course',
      survey_data: {course: 'CS Principles', pd: false},
      allow_multiple_submissions: false
    },
    {
      form_name: 'surveys/teachers/teacher_end_of_year_survey',
      path: 'csp_post_course_pd',
      survey_data: {course: 'CS Principles', pd: true},
      allow_multiple_submissions: false
    },
    {
      form_name: 'surveys/pd/csd_csp_facilitator_post_survey',
      path: 'facilitator_post_survey',
      allow_multiple_submissions: true
    }
  ].freeze

  def up
    EXISTING_SIMPLE_SURVEY_FORMS.each do |form_attributes|
      Foorm::SimpleSurveyForm.create! form_attributes
    end
  end
end
