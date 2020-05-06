require 'test_helper'

class ParentLevelsChildLevelTest < ActiveSupport::TestCase
  self.use_transactional_test_case = true

  test 'validate child level kind' do
    parent = create :level
    child = create :level
    ParentLevelsChildLevel.find_or_create_by!(
      parent_level: parent,
      child_level: child,
      kind: ParentLevelsChildLevel::CONTAINED
    )
    child = create :level
    ParentLevelsChildLevel.find_or_create_by!(
      parent_level: parent,
      child_level: child,
      kind: ParentLevelsChildLevel::PROJECT_TEMPLATE
    )
    child = create :level
    ParentLevelsChildLevel.find_or_create_by!(
      parent_level: parent,
      child_level: child,
      kind: ParentLevelsChildLevel::SUBLEVEL
    )

    # kind defaults to 'sublevel'
    child = create :level
    ParentLevelsChildLevel.find_or_create_by!(
      parent_level: parent,
      child_level: child
    )

    child = create :level
    assert_raises ActiveRecord::RecordInvalid do
      ParentLevelsChildLevel.find_or_create_by!(
        parent_level: parent,
        child_level: child,
        kind: 'bogus'
      )
    end
  end
end
