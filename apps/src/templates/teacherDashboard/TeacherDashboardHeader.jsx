import React from 'react';
import {connect} from 'react-redux';
import {switchToSection} from './urlHelpers';
import PropTypes from 'prop-types';
import i18n from '@cdo/locale';
import SmallChevronLink from '../SmallChevronLink';
import SelectSectionDropdown from './SelectSectionDropdown';
import SelectSectionButton from './SelectSectionButton';
import TeacherDashboardNavigation from './TeacherDashboardNavigation';
import {SetScriptIdEditSectionDialog} from './EditSectionDialog';
import {beginEditingSection} from './teacherSectionsRedux';
import Button from '../Button';

const styles = {
  headerContainer: {
  },
  headerSectionPrompt: {
    fontWeight: 'bold'
  },
  headerSubtext: {
    display: 'flex',
    justifyContent: 'space-between'
  },
  headerButtons: {
    display:'flex'
  },
};

class TeacherDashboardHeader extends React.Component {
  static propTypes = {
    currentSectionName: PropTypes.string.isRequired,
    currentScriptName: PropTypes.string.isRequired
  };

  render() {
    return (
      <div>
        <SmallChevronLink
          link="/home#classroom-sections"
          linkText={i18n.viewAllSections()}
          isRtl={true}
          chevronSide="left"
        />
        <div>
          <div>
            <h1>{this.props.currentSectionName}</h1>
            <div style={styles.headerSubtext}>
              <div>
                  <span style={styles.headerSectionPrompt}>Assigned to:</span>
                  {` ${this.props.currentScriptName}`}
              </div>
              <div style={styles.headerButtons}>
                <Button
                  onClick={() => {
                    this.props.dispatch(
                      beginEditingSection(this.props.currentSectionId)
                    );
                  }}
                  icon="gear"
                  size="thin"
                  color="gray"
                  text="Edit section details"
                />
                <SelectSectionButton
                  onChangeOption={(option) => switchToSection(option.id, this.props.currentSectionId)}
                />
              </div>
            </div>
          </div>
        </div>
        <TeacherDashboardNavigation />
        <SetScriptIdEditSectionDialog />
      </div>
    );
  }
}

export default connect(state => {
  let currentSectionId = state.teacherSections.selectedSectionId;
  let currentSectionName =
    state.teacherSections.sections[currentSectionId].name;

  let currentScriptId = state.scriptSelection.scriptId;
  let currentScriptName = state.scriptSelection.validScripts.filter(
    script => script.id === currentScriptId
  )[0].name;

  return {currentSectionName, currentScriptName, currentSectionId};
})(TeacherDashboardHeader);
