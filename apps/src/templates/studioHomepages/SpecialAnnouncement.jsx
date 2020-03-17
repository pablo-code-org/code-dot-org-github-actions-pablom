import PropTypes from 'prop-types';
import React, {Component} from 'react';
import {TwoColumnActionBlock} from './TwoColumnActionBlock';
import {pegasus} from '@cdo/apps/lib/util/urlHelpers';
import i18n from '@cdo/locale';

// This component differs from the SpecialAnnouncementActionBlock because it is // not managed by the json system and can therefore be fully translated and can // be shown to users viewing the site in languages other than English.
export default class SpecialAnnouncement extends Component {
  static propTypes = {
    isTeacher: PropTypes.bool
  };

  render() {
    const {isTeacher} = this.props;
    const headingText = isTeacher
      ? i18n.teacherAnnouncementSpecial2020Heading()
      : i18n.studentAnnouncementSpecial2020Heading();
    const descriptionText = isTeacher
      ? i18n.teacherAnnouncementSpecial2020Description()
      : i18n.studentAnnouncementSpecial2020Description();
    const id = isTeacher
      ? 'teacher_homepage_announcement_special2020'
      : 'student_homepage_announcement_special2020';

    return (
      <TwoColumnActionBlock
        imageUrl={pegasus(
          '/shared/images/fill-540x300/announcement/announcement_special2020.jpg'
        )}
        subHeading={headingText}
        description={descriptionText}
        buttons={[
          {
            id: id,
            url: pegasus('/athome'),
            text: i18n.studentAnnouncementSpecial2020Button()
          }
        ]}
      />
    );
  }
}
