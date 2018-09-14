module Pd
  module PrincipalApproval1920ApplicationConstants
    include Pd::PrincipalApprovalCommonApplicationConstants

    PAGE_LABELS = {
      first_name: 'Principal First Name',
      last_name: 'Principal Last Name',
      title: 'Principal Title',
      email: 'Principal Email Address',
      total_student_enrollment: 'Total student enrollment',
      free_lunch_percent: 'Percentage of students who are eligible to receive free or reduced lunch',
      white: 'White',
      black: 'Black or African American',
      hispanic: 'Hispanic or Latino',
      asian: 'Asian',
      pacific_islander: 'Native Hawaiian or other Pacific Islander',
      american_indian: 'American Indian or Native Alaskan',
      other: 'Other',
      replace_course: 'Will this course replace an existing computer science course in the master schedule? If yes, please list the course(s) that will be replaced.',
      replace_which_course_csp: 'Which existing course or curriculum will CS Principles replace? Mark all that apply.',
      replace_which_course_csd: 'Which existing course or curriculum will CS Discoveries replace? Mark all that apply.',
      understand_fee: 'By checking this box, you indicate that you understand there may be a fee for the professional learning program your teacher attends.',
      pay_fee: 'If there is a fee for the program, will your teacher or your school be able to pay for the fee?',
      want_funding: 'Yes, I would like to be considered for funding support.',
      how_heard: 'How did you hear about Code.org’s Professional Learning program?',
      confirm_principal: 'By submitting this application, I confirm I am the principal of this school.',

      school: 'School',
      school_name: 'School Name',
      school_address: 'School Address',
      school_city: 'City',
      school_state: 'State',
      school_zip_code: 'Zip Code',
      school_type: 'My school is a',
    }.freeze
  end
end
