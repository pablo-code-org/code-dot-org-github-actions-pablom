import React from 'react';
import GameButtons from '../templates/GameButtons';
import ArrowButtons from '../templates/ArrowButtons';
import BelowVisualization from '../templates/BelowVisualization';
import {MAX_GAME_WIDTH, GAME_HEIGHT} from './constants';
import ProtectedVisualizationDiv from '../templates/ProtectedVisualizationDiv';
import PropTypes from 'prop-types';
import Radium from 'radium';
import {connect} from 'react-redux';
import i18n from '@cdo/locale';
import AgeDialog, {
  signedOutUnder13 as signedOutAgeCheck,
  songFilterOn
} from '../templates/AgeDialog';

const SongSelector = Radium(
  class extends React.Component {
    static propTypes = {
      enableSongSelection: PropTypes.bool,
      setSong: PropTypes.func.isRequired,
      selectedSong: PropTypes.string,
      songData: PropTypes.objectOf(PropTypes.object).isRequired,
      filterOn: PropTypes.bool.isRequired
    };

    changeSong = event => {
      const songId = event.target.value;
      this.props.setSong(songId);
    };

    render() {
      const {
        selectedSong,
        songData,
        enableSongSelection,
        filterOn
      } = this.props;

      let songKeys = Object.keys(songData);
      if (filterOn) {
        // Filter is on, only include songs that are not pg13
        songKeys = songKeys.filter(key => !songData[key].pg13);
      }

      return (
        <div id="song-selector-wrapper">
          <label>
            <b>{i18n.selectSong()}</b>
          </label>
          <select
            id="song_selector"
            style={styles.selectStyle}
            onChange={this.changeSong}
            value={selectedSong}
            disabled={!enableSongSelection}
          >
            {songKeys.map((option, i) => (
              <option key={i} value={option}>
                {songData[option].title}
              </option>
            ))}
          </select>
        </div>
      );
    }
  }
);

class DanceVisualizationColumn extends React.Component {
  static propTypes = {
    showFinishButton: PropTypes.bool.isRequired,
    setSong: PropTypes.func.isRequired,
    selectedSong: PropTypes.string,
    levelIsRunning: PropTypes.bool,
    levelRunIsStarting: PropTypes.bool,
    isShareView: PropTypes.bool.isRequired,
    songData: PropTypes.objectOf(PropTypes.object).isRequired,
    userType: PropTypes.string.isRequired,
    under13: PropTypes.bool.isRequired
  };

  state = {
    filterOn: this.getFilterStatus()
  };

  /*
    Turn the song filter off
  */
  turnFilterOff = () => {
    this.setState({filterOn: false});
  };

  /*
    The filter defaults to on. If the user is over 13 (identified via account or anon dialog), filter turns off.
   */
  getFilterStatus() {
    const {userType, under13} = this.props;

    // Check if song filter override is triggered and initialize song filter to true.
    const songFilter = songFilterOn();
    if (songFilter) {
      return true;
    }

    // userType - 'teacher', 'student', 'unknown' - signed out users.
    // under13 - boolean for signed in user representing age category. Teacher assumed > 13.
    const signedInUnder13 = userType === 'student' && under13;
    const signedOutUnder13 = signedOutAgeCheck();

    // Return true (filter on) if user is under 13, whether they are signed in or out.
    // Return false if the user is over 13, signed in or out.
    return signedInUnder13 || signedOutUnder13;
  }

  render() {
    const filenameToImgUrl = {
      'click-to-run': require('@cdo/static/dance/click-to-run.png')
    };

    const imgSrc = filenameToImgUrl['click-to-run'];

    const enableSongSelection =
      !this.props.levelIsRunning && !this.props.levelRunIsStarting;

    return (
      <div>
        {!this.props.isShareView && (
          <AgeDialog turnOffFilter={this.turnFilterOff} />
        )}
        <div style={{maxWidth: MAX_GAME_WIDTH}}>
          {!this.props.isShareView && (
            <SongSelector
              enableSongSelection={enableSongSelection}
              setSong={this.props.setSong}
              selectedSong={this.props.selectedSong}
              songData={this.props.songData}
              filterOn={this.state.filterOn}
            />
          )}
          <ProtectedVisualizationDiv>
            <div
              id="divDance"
              style={{...styles.visualization, ...styles.container}}
            >
              <div
                id="divDanceLoading"
                style={{...styles.visualization, ...styles.loadingContainer}}
              >
                <img
                  src="//curriculum.code.org/images/DancePartyLoading.gif"
                  style={styles.loadingGif}
                />
              </div>
              {this.props.isShareView && (
                <img src={imgSrc} id="danceClickToRun" />
              )}
            </div>
          </ProtectedVisualizationDiv>
          <GameButtons showFinishButton={this.props.showFinishButton}>
            <ArrowButtons />
          </GameButtons>
          <BelowVisualization />
        </div>
      </div>
    );
  }
}

const styles = {
  visualization: {
    width: MAX_GAME_WIDTH,
    height: GAME_HEIGHT
  },
  container: {
    touchAction: 'none',
    background: '#fff',
    position: 'relative',
    overflow: 'hidden'
  },
  loadingContainer: {
    // The value of display is controlled by StudioApp.
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingGif: {
    width: 100,
    height: 100
  },
  selectStyle: {
    width: '100%'
  }
};

export default connect(state => ({
  isShareView: state.pageConstants.isShareView,
  songData: state.songs.songData,
  selectedSong: state.songs.selectedSong,
  userType: state.currentUser.userType,
  under13: state.currentUser.under13,
  levelIsRunning: state.runState.isRunning,
  levelRunIsStarting: state.songs.runIsStarting
}))(DanceVisualizationColumn);
