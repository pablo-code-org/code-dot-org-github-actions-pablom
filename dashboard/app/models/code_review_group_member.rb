# == Schema Information
#
# Table name: code_review_group_members
#
#  code_review_group_id :bigint           not null
#  follower_id          :bigint           not null
#  created_at           :datetime         not null
#  updated_at           :datetime         not null
#
# Indexes
#
#  index_code_review_group_members_on_code_review_group_id  (code_review_group_id)
#  index_code_review_group_members_on_follower_id           (follower_id)
#
class CodeReviewGroupMember < ApplicationRecord
  def name
    follower = Follower.find(follower_id)
    User.find(follower.student_user_id).name
  end
end
