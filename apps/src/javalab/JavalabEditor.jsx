import React from 'react';
import {connect} from 'react-redux';
import Radium from 'radium'; // eslint-disable-line no-restricted-imports
import {
  setSource,
  sourceTextUpdated,
  sourceVisibilityUpdated,
  sourceValidationUpdated,
  renameFile,
  removeFile,
  setRenderedHeight,
  setEditorColumnHeight,
  setEditTabKey,
  setActiveTabKey,
  setOrderedTabKeys,
  setFileMetadata,
  setAllEditorMetadata
} from './javalabRedux';
import {DisplayTheme} from './DisplayTheme';
import PropTypes from 'prop-types';
import PaneHeader, {
  PaneSection,
  PaneButton
} from '@cdo/apps/templates/PaneHeader';
import {EditorView} from '@codemirror/view';
import {editorSetup, lightMode} from './editorSetup';
import {EditorState, Compartment} from '@codemirror/state';
import {projectChanged} from '@cdo/apps/code-studio/initApp/project';
import {oneDark} from '@codemirror/theme-one-dark';
import color from '@cdo/apps/util/color';
import {Tab, Nav, NavItem} from 'react-bootstrap';
import NameFileDialog from './NameFileDialog';
import JavalabDialog from './JavalabDialog';
import CommitDialog from './CommitDialog';
import JavalabEditorTabMenu from './JavalabEditorTabMenu';
import JavalabFileExplorer from './JavalabFileExplorer';
import Backpack from './Backpack';
import FontAwesome from '@cdo/apps/templates/FontAwesome';
import _ from 'lodash';
import msg from '@cdo/locale';
import javalabMsg from '@cdo/javalab/locale';
import {CompileStatus} from './constants';
import {makeEnum} from '@cdo/apps/utils';
import {hasQueryParam} from '@cdo/apps/code-studio/utils';
import ProjectTemplateWorkspaceIcon from '../templates/ProjectTemplateWorkspaceIcon';
import {getDefaultFileContents, getTabKey} from './JavalabFileHelper';
import VersionHistoryWithCommitsDialog from '@cdo/apps/templates/VersionHistoryWithCommitsDialog';

const MIN_HEIGHT = 100;
// This is the height of the "editor" header and the file tabs combined
const HEADER_OFFSET = 63;
const Dialog = makeEnum(
  'RENAME_FILE',
  'DELETE_FILE',
  'CREATE_FILE',
  'COMMIT_FILES',
  'VERSION_HISTORY'
);
const DEFAULT_FILE_NAME = '.java';
const EDITOR_LOAD_PAUSE_MS = 100;

// Custom theme overrides (exported for tests)
export const editorDarkModeThemeOverride = EditorView.theme(
  {
    // Sets the background color for the main editor area
    '&': {
      backgroundColor: color.darkest_slate_gray
    },
    // Sets the background color for the currently selected line
    '.cm-activeLine': {
      backgroundColor: color.dark_gray
    },
    // Sets the background color for the left-hand side gutters
    '.cm-gutters': {
      backgroundColor: color.darkest_slate_gray
    }
  },
  {dark: true}
);
export const editorLightModeThemeOverride = EditorView.theme(
  {
    // Sets the background color for the main editor area
    '&': {
      backgroundColor: color.white
    },
    // Sets the background color for the left-hand side gutters
    '.cm-gutters': {
      backgroundColor: color.white
    }
  },
  {dark: false}
);

class JavalabEditor extends React.Component {
  static propTypes = {
    style: PropTypes.object,
    onCommitCode: PropTypes.func.isRequired,
    isProjectTemplateLevel: PropTypes.bool.isRequired,
    handleClearPuzzle: PropTypes.func.isRequired,
    viewMode: PropTypes.string,

    // populated by redux
    setSource: PropTypes.func,
    sourceVisibilityUpdated: PropTypes.func,
    sourceValidationUpdated: PropTypes.func,
    sourceTextUpdated: PropTypes.func,
    renameFile: PropTypes.func,
    removeFile: PropTypes.func,
    sources: PropTypes.object,
    validation: PropTypes.object,
    displayTheme: PropTypes.oneOf(Object.values(DisplayTheme)),
    height: PropTypes.number,
    isEditingStartSources: PropTypes.bool,
    isReadOnlyWorkspace: PropTypes.bool.isRequired,
    hasOpenCodeReview: PropTypes.bool,
    isViewingOwnProject: PropTypes.bool,
    backpackEnabled: PropTypes.bool,
    showProjectTemplateWorkspaceIcon: PropTypes.bool.isRequired,
    codeOwnersName: PropTypes.string,
    fileMetadata: PropTypes.object.isRequired,
    setFileMetadata: PropTypes.func.isRequired,
    orderedTabKeys: PropTypes.array.isRequired,
    setOrderedTabKeys: PropTypes.func.isRequired,
    activeTabKey: PropTypes.string,
    setActiveTabKey: PropTypes.func.isRequired,
    lastTabKeyIndex: PropTypes.number.isRequired,
    editTabKey: PropTypes.string,
    setEditTabKey: PropTypes.func.isRequired,
    setAllEditorMetadata: PropTypes.func.isRequired
  };

  constructor(props) {
    super(props);

    this.onChangeTabs = this.onChangeTabs.bind(this);
    this.toggleTabMenu = this.toggleTabMenu.bind(this);
    this.renameFromTabMenu = this.renameFromTabMenu.bind(this);
    this.deleteFromTabMenu = this.deleteFromTabMenu.bind(this);
    this.cancelTabMenu = this.cancelTabMenu.bind(this);

    this.onRenameFile = this.onRenameFile.bind(this);
    this.onCreateFile = this.onCreateFile.bind(this);
    this.onDeleteFile = this.onDeleteFile.bind(this);
    this.onOpenFile = this.onOpenFile.bind(this);
    this.onOpenCommitDialog = this.onOpenCommitDialog.bind(this);
    this.updateVisibility = this.updateVisibility.bind(this);
    this.updateValidation = this.updateValidation.bind(this);
    this.updateFileType = this.updateFileType.bind(this);
    this.onImportFile = this.onImportFile.bind(this);
    this._codeMirrors = {};

    // Used to manage dark and light mode configuration.
    this.editorModeConfigCompartment = new Compartment();
    this.editorThemeOverrideCompartment = new Compartment();

    // Used to manage readOnly/editable configuration.
    this.editorEditableCompartment = new Compartment();
    this.editorReadOnlyCompartment = new Compartment();

    this.state = {
      showMenu: false,
      contextTarget: null,
      openDialog: null,
      menuPosition: {},
      newFileError: null,
      renameFileError: null,
      fileToDelete: null,
      compileStatus: CompileStatus.NONE
    };
  }

  componentDidMount() {
    this.editors = {};
    const {sources, orderedTabKeys, fileMetadata} = this.props;
    orderedTabKeys.forEach(tabKey => {
      this.createEditor(tabKey, sources[fileMetadata[tabKey]].text);
    });
  }

  componentDidUpdate(prevProps) {
    if (prevProps.displayTheme !== this.props.displayTheme) {
      const styleOverride =
        this.props.displayTheme === DisplayTheme.DARK
          ? editorDarkModeThemeOverride
          : editorLightModeThemeOverride;
      const newStyle =
        this.props.displayTheme === DisplayTheme.DARK ? oneDark : lightMode;

      Object.keys(this.editors).forEach(editorKey => {
        this.editors[editorKey].dispatch({
          effects: [
            this.editorThemeOverrideCompartment.reconfigure(styleOverride),
            this.editorModeConfigCompartment.reconfigure(newStyle)
          ]
        });
      });
    }

    if (prevProps.isReadOnlyWorkspace !== this.props.isReadOnlyWorkspace) {
      Object.keys(this.editors).forEach(editorKey => {
        this.editors[editorKey].dispatch({
          effects: [
            this.editorEditableCompartment.reconfigure(
              EditorView.editable.of(!this.props.isReadOnlyWorkspace)
            ),
            this.editorReadOnlyCompartment.reconfigure(
              EditorState.readOnly.of(this.props.isReadOnlyWorkspace)
            )
          ]
        });
      });
    }

    const {fileMetadata} = this.props;

    if (
      !_.isEqual(Object.keys(prevProps.fileMetadata), Object.keys(fileMetadata))
    ) {
      for (const tabKey in fileMetadata) {
        if (!this.editors[tabKey]) {
          // create an editor if it doesn't exist yet
          const source = this.props.sources[fileMetadata[tabKey]];
          const doc = (source && source.text) || '';
          this.createEditor(tabKey, doc);
        }
      }
    }
  }

  createEditor(key, doc) {
    const {displayTheme, isReadOnlyWorkspace} = this.props;
    const extensions = [...editorSetup];

    extensions.push(
      displayTheme === DisplayTheme.DARK
        ? [
            this.editorThemeOverrideCompartment.of(editorDarkModeThemeOverride),
            this.editorModeConfigCompartment.of(oneDark)
          ]
        : [
            this.editorThemeOverrideCompartment.of(
              editorLightModeThemeOverride
            ),
            this.editorModeConfigCompartment.of(lightMode)
          ]
    );

    extensions.push(
      this.editorEditableCompartment.of(
        EditorView.editable.of(!isReadOnlyWorkspace)
      ),
      this.editorReadOnlyCompartment.of(
        EditorState.readOnly.of(isReadOnlyWorkspace)
      )
    );

    this.editors[key] = new EditorView({
      state: EditorState.create({
        doc: doc,
        extensions: extensions
      }),
      parent: this._codeMirrors[key],
      dispatch: this.dispatchEditorChange(key)
    });
  }

  dispatchEditorChange = key => {
    const {sourceTextUpdated} = this.props;

    // tr is a code mirror transaction
    // see https://codemirror.net/6/docs/ref/#state.Transaction
    return tr => {
      // we are overwriting the default dispatch method for codemirror,
      // so we need to manually call the update method.
      this.editors[key].update([tr]);
      // if there are changes to the editor, update redux.
      if (!tr.changes.empty && tr.newDoc) {
        sourceTextUpdated(this.props.fileMetadata[key], tr.newDoc.toString());
        projectChanged();
      }
    };
  };

  updateVisibility(key, isVisible) {
    this.props.sourceVisibilityUpdated(this.props.fileMetadata[key], isVisible);
    this.setState({
      showMenu: false,
      contextTarget: null
    });
  }

  updateValidation(key, isValidation) {
    this.props.sourceValidationUpdated(
      this.props.fileMetadata[key],
      isValidation
    );
    this.setState({
      showMenu: false,
      contextTarget: null
    });
  }

  updateFileType(key, isVisible, isValidation) {
    this.updateVisibility(key, isVisible);
    this.updateValidation(key, isValidation);
  }

  makeListeners(key) {
    return {
      onContextMenu: e => {
        this.openTabContextMenu(key, e);
      }
    };
  }

  onChangeTabs(key) {
    if (key !== this.props.activeTabKey) {
      this.props.setActiveTabKey(key);
      this.setState({
        showMenu: false,
        contextTarget: null
      });
      // scroll the new editor to whatever its current selection is.
      // If this editor has no selection it will stay at the top of the file.
      this.editors[key].dispatch({
        scrollIntoView: true
      });
      // It takes a second for the editor to show up. We can't
      // focus on it until it is visible, so we set a delay to focus
      // on the new editor.
      const timer = setInterval(() => {
        this.editors[key].focus();
        if (this.editors[key].hasFocus) {
          // stop trying to focus once we have focused.
          clearInterval(timer);
        }
      }, EDITOR_LOAD_PAUSE_MS);
    }
  }

  // This opens and closes the dropdown menu on the active tab
  toggleTabMenu(key, e) {
    if (key === this.state.contextTarget) {
      this.cancelTabMenu();
    } else {
      e.preventDefault();
      const boundingRect = e.target.getBoundingClientRect();
      this.setState({
        showMenu: true,
        contextTarget: key,
        menuPosition: {
          top: `${boundingRect.bottom}px`,
          left: `${boundingRect.left}px`
        }
      });
    }
  }

  // This is called from the dropdown menu on the active tab
  // when the rename option is clicked
  renameFromTabMenu() {
    this.props.setEditTabKey(this.state.contextTarget);
    this.setState({
      showMenu: false,
      contextTarget: null,
      openDialog: Dialog.RENAME_FILE
    });
  }

  // This closes the dropdown menu on the active tab
  cancelTabMenu() {
    this.setState({
      showMenu: false,
      contextTarget: null
    });
  }

  // This is called from the dropdown menu on the active tab
  // when the delete option is clicked
  deleteFromTabMenu() {
    this.setState({
      showMenu: false,
      contextTarget: null,
      openDialog: Dialog.DELETE_FILE,
      fileToDelete: this.state.contextTarget
    });
  }

  // Checks if the given file name is valid and if not,
  // updates the state with the appropriate error message.
  // Returns whether or not the file name is valid.
  validateFileName(filename, errorStateKey) {
    let errorMessage;

    if (!filename) {
      errorMessage = javalabMsg.missingFilenameError();
    } else if (
      filename === '.java' ||
      (filename.toLowerCase().endsWith('.java') && !filename.endsWith('.java'))
    ) {
      // if filename is either only '.java' or ends with a non-lowercase casing of '.java',
      // give an error with an example Java filename.
      errorMessage = javalabMsg.invalidJavaFilenameFormat();
    } else if (filename.endsWith('.java') && /\s/g.test(filename)) {
      // Java file names cannot contains spaces
      errorMessage = javalabMsg.invalidJavaFilename();
    }

    if (errorMessage) {
      this.setState({
        [errorStateKey]: errorMessage
      });
    }

    return !errorMessage;
  }

  onRenameFile(newFilename) {
    newFilename = newFilename.trim();
    if (!this.validateFileName(newFilename, 'renameFileError')) {
      return;
    }
    const {fileMetadata, setFileMetadata, editTabKey, renameFile} = this.props;
    // check for duplicate filename
    const duplicateFileError = this.checkDuplicateFileName(newFilename);
    if (duplicateFileError) {
      this.setState({
        renameFileError: duplicateFileError
      });
      return;
    }

    // update file metadata with new filename
    const newFileMetadata = {...fileMetadata};
    newFileMetadata[editTabKey] = newFilename;
    const oldFilename = fileMetadata[editTabKey];

    // update sources with new filename
    renameFile(oldFilename, newFilename);
    setFileMetadata(newFileMetadata);
    projectChanged();
    this.setState({
      openDialog: null,
      renameFileError: null
    });
  }

  onCreateFile(filename, fileContents) {
    filename = filename.trim();
    if (!this.validateFileName(filename, 'newFileError')) {
      return;
    }
    const duplicateFileError = this.checkDuplicateFileName(filename);
    if (duplicateFileError) {
      this.setState({
        newFileError: duplicateFileError
      });
      return;
    }

    const {
      lastTabKeyIndex,
      fileMetadata,
      orderedTabKeys,
      setSource,
      setAllEditorMetadata
    } = this.props;
    const newTabIndex = lastTabKeyIndex + 1;
    const newTabKey = getTabKey(newTabIndex);

    fileContents =
      fileContents || getDefaultFileContents(filename, this.props.viewMode);

    // update file key to filename map with new file name
    const newFileMetadata = {...fileMetadata};
    newFileMetadata[newTabKey] = filename;

    // add new key to tabs
    let newTabs = [...orderedTabKeys];
    newTabs.push(newTabKey);

    // add new file to sources
    setSource(filename, fileContents);
    projectChanged();

    // add new tab and set it as the active tab
    setAllEditorMetadata(newFileMetadata, newTabs, newTabKey, newTabIndex);
    this.setState({
      openDialog: null,
      newFileError: null
    });
  }

  onDeleteFile() {
    const {fileToDelete} = this.state;
    const {
      fileMetadata,
      orderedTabKeys,
      activeTabKey,
      removeFile,
      setAllEditorMetadata
    } = this.props;
    // find tab in list
    const indexToRemove = orderedTabKeys.indexOf(fileToDelete);

    if (indexToRemove >= 0) {
      // delete from tabs
      let newTabs = [...orderedTabKeys];
      newTabs.splice(indexToRemove, 1);
      let newActiveTabKey = activeTabKey;
      // we need to update the active tab if we are deleting the currently active tab
      if (activeTabKey === fileToDelete) {
        // if there is still at least 1 file, go to first file, otherwise wipe out active tab key
        newActiveTabKey = newTabs.length > 0 ? newTabs[0] : null;
      }

      // delete tab key from tab to filename map
      const newFileMetadata = {...fileMetadata};
      delete newFileMetadata[fileToDelete];
      // clean up editors
      delete this.editors[fileToDelete];

      setAllEditorMetadata(newFileMetadata, newTabs, newActiveTabKey);

      // delete from sources
      removeFile(fileMetadata[fileToDelete]);
      projectChanged();
    }

    this.setState({
      showMenu: false,
      contextTarget: null,
      openDialog: null,
      fileToDelete: null
    });
  }

  onImportFile(filename, fileContents) {
    const {fileMetadata} = this.props;
    // If filename already exists in sources, replace file contents.
    // Otherwise, create a new file.
    if (Object.keys(this.props.sources).includes(filename)) {
      // find editor for filename and overwrite contents of that editor
      let editorKey = null;
      for (const key in fileMetadata) {
        if (fileMetadata[key] === filename) {
          editorKey = key;
        }
      }
      const editor = this.editors[editorKey];
      editor.dispatch({
        changes: {from: 0, to: editor.state.doc.length, insert: fileContents}
      });
      this.props.setSource(filename, fileContents);
    } else {
      // create new file
      this.onCreateFile(filename, fileContents);
    }
    projectChanged();
  }

  duplicateFileError(filename) {
    return javalabMsg.duplicateProjectFilenameError({filename: filename});
  }

  duplicateSupportFileError(filename) {
    return javalabMsg.duplicateSupportFilenameError({filename: filename});
  }

  /**
   * Checks if the new file name already exists in the project in both user and support code.
   * Returns the appropriate error message if so.
   */
  checkDuplicateFileName(newFilename) {
    if (Object.keys(this.props.sources).includes(newFilename)) {
      return this.props.sources[newFilename].isVisible
        ? this.duplicateFileError(newFilename)
        : this.duplicateSupportFileError(newFilename);
    } else if (Object.keys(this.props.validation).includes(newFilename)) {
      return this.duplicateSupportFileError(newFilename);
    }
  }

  // This is called from the file explorer when we want to jump to a file
  onOpenFile(key) {
    const {orderedTabKeys, setOrderedTabKeys, setActiveTabKey} = this.props;
    let newTabs = [...orderedTabKeys];
    let selectedFileIndex = newTabs.indexOf(key);
    newTabs.splice(selectedFileIndex, 1);
    newTabs.unshift(key);

    setActiveTabKey(key);
    setOrderedTabKeys(newTabs);

    // closes the tab menu if it is open
    this.setState({
      showMenu: false,
      contextTarget: null
    });
  }

  onOpenCommitDialog() {
    // When the dialog opens, we will compile the user's files and notify them of success/errors.
    // For now, this is mocked out to successfully compile after a set amount of time.
    this.setState({
      openDialog: Dialog.COMMIT_FILES,
      compileStatus: CompileStatus.LOADING
    });
    setTimeout(() => {
      this.setState({compileStatus: CompileStatus.SUCCESS});
    }, 500);
  }

  editorHeaderText = () =>
    this.props.isReadOnlyWorkspace
      ? msg.readonlyWorkspaceHeader()
      : javalabMsg.editor();

  render() {
    const {
      openDialog,
      fileToDelete,
      contextTarget,
      renameFileError,
      newFileError,
      compileStatus
    } = this.state;
    const {
      onCommitCode,
      displayTheme,
      sources,
      isEditingStartSources,
      isReadOnlyWorkspace,
      hasOpenCodeReview,
      isViewingOwnProject,
      showProjectTemplateWorkspaceIcon,
      height,
      isProjectTemplateLevel,
      handleClearPuzzle,
      backpackEnabled,
      orderedTabKeys,
      fileMetadata,
      activeTabKey,
      editTabKey,
      codeOwnersName
    } = this.props;

    const showOpenCodeReviewWarning =
      isReadOnlyWorkspace && hasOpenCodeReview && !hasQueryParam('version');

    let menuStyle = {
      display: this.state.showMenu ? 'block' : 'none',
      position: 'fixed',
      top: this.state.menuPosition.top,
      left: this.state.menuPosition.left,
      backgroundColor: '#F0F0F0',
      zIndex: 1000
    };
    return (
      <div style={this.props.style}>
        <PaneHeader hasFocus>
          <PaneButton
            id="javalab-editor-create-file"
            iconClass="fa fa-plus-circle"
            onClick={() => this.setState({openDialog: Dialog.CREATE_FILE})}
            headerHasFocus
            isRtl={false}
            label={javalabMsg.newFile()}
            leftJustified
            isDisabled={isReadOnlyWorkspace}
          />
          {backpackEnabled && (
            <PaneSection style={styles.backpackSection}>
              <Backpack
                id={'javalab-editor-backpack'}
                displayTheme={displayTheme}
                isButtonDisabled={isReadOnlyWorkspace}
                onImport={this.onImportFile}
              />
            </PaneSection>
          )}
          <PaneButton
            id="data-mode-versions-header"
            iconClass="fa fa-clock-o"
            label={msg.showVersionsHeader()}
            headerHasFocus
            isRtl={false}
            onClick={() => this.setState({openDialog: Dialog.VERSION_HISTORY})}
            isDisabled={isReadOnlyWorkspace}
          />
          <PaneButton
            id="javalab-editor-save"
            iconClass="fa fa-check-circle"
            onClick={this.onOpenCommitDialog}
            headerHasFocus
            isRtl={false}
            label={javalabMsg.commitCode()}
            isDisabled={isReadOnlyWorkspace}
          />
          <PaneSection>
            {showProjectTemplateWorkspaceIcon && (
              <ProjectTemplateWorkspaceIcon />
            )}
            {this.editorHeaderText()}
          </PaneSection>
        </PaneHeader>
        <Tab.Container
          activeKey={activeTabKey}
          onSelect={key => this.onChangeTabs(key)}
          id="javalab-editor-tabs"
          className={displayTheme === DisplayTheme.DARK ? 'darkmode' : ''}
        >
          <div>
            <Nav bsStyle="tabs" style={styles.tabs}>
              <JavalabFileExplorer
                fileMetadata={fileMetadata}
                onSelectFile={this.onOpenFile}
                displayTheme={displayTheme}
              />
              {orderedTabKeys.map(tabKey => {
                return (
                  <NavItem eventKey={tabKey} key={`${tabKey}-tab`}>
                    {isEditingStartSources && (
                      <FontAwesome
                        style={styles.fileTypeIcon}
                        icon={
                          sources[fileMetadata[tabKey]].isVisible
                            ? 'eye'
                            : sources[fileMetadata[tabKey]].isValidation
                            ? 'flask'
                            : 'eye-slash'
                        }
                      />
                    )}
                    {!isEditingStartSources && (
                      <FontAwesome
                        style={styles.fileTypeIcon}
                        icon={'file-text'}
                      />
                    )}
                    <span>{fileMetadata[tabKey]}</span>

                    <button
                      ref={`${tabKey}-file-toggle`}
                      type="button"
                      style={{
                        ...styles.fileMenuToggleButton,
                        ...(displayTheme === DisplayTheme.DARK &&
                          styles.darkFileMenuToggleButton),
                        ...((isReadOnlyWorkspace ||
                          activeTabKey !== tabKey) && {
                          visibility: 'hidden'
                        })
                      }}
                      onClick={e => this.toggleTabMenu(tabKey, e)}
                      className="no-focus-outline"
                      disabled={isReadOnlyWorkspace || activeTabKey !== tabKey}
                    >
                      <FontAwesome
                        icon={
                          contextTarget === tabKey ? 'caret-up' : 'caret-down'
                        }
                      />
                    </button>
                  </NavItem>
                );
              })}
            </Nav>
            <div style={menuStyle}>
              <JavalabEditorTabMenu
                cancelTabMenu={this.cancelTabMenu}
                renameFromTabMenu={this.renameFromTabMenu}
                deleteFromTabMenu={this.deleteFromTabMenu}
                changeFileTypeFromTabMenu={(isVisible, isValidation) =>
                  this.updateFileType(activeTabKey, isVisible, isValidation)
                }
                showVisibilityOption={isEditingStartSources}
                fileIsVisible={
                  sources[fileMetadata[activeTabKey]] &&
                  sources[fileMetadata[activeTabKey]].isVisible
                }
                fileIsValidation={
                  sources[fileMetadata[activeTabKey]] &&
                  sources[fileMetadata[activeTabKey]].isValidation
                }
              />
            </div>
            <Tab.Content id="tab-content" animation={false}>
              {showOpenCodeReviewWarning && (
                <div
                  id="openCodeReviewWarningBanner"
                  style={styles.openCodeReviewWarningBanner}
                >
                  {isViewingOwnProject
                    ? javalabMsg.editingDisabledUnderReview()
                    : javalabMsg.codeReviewingPeer({
                        peerName: codeOwnersName
                      })}
                </div>
              )}
              {orderedTabKeys.map(tabKey => {
                return (
                  <Tab.Pane eventKey={tabKey} key={`${tabKey}-content`}>
                    <div
                      ref={el => (this._codeMirrors[tabKey] = el)}
                      style={{
                        ...styles.editor,
                        ...(displayTheme === DisplayTheme.DARK &&
                          styles.darkBackground),
                        ...{height: height - HEADER_OFFSET}
                      }}
                    />
                  </Tab.Pane>
                );
              })}
            </Tab.Content>
          </div>
        </Tab.Container>
        <JavalabDialog
          isOpen={openDialog === Dialog.DELETE_FILE}
          handleConfirm={this.onDeleteFile}
          handleClose={() => this.setState({openDialog: null})}
          message={javalabMsg.deleteFileConfirmation({
            filename: fileMetadata[fileToDelete]
          })}
          displayTheme={displayTheme}
          confirmButtonText={javalabMsg.delete()}
          closeButtonText={javalabMsg.cancel()}
        />
        <NameFileDialog
          isOpen={openDialog === Dialog.RENAME_FILE}
          handleClose={() =>
            this.setState({openDialog: null, renameFileError: null})
          }
          filename={fileMetadata[editTabKey]}
          handleSave={this.onRenameFile}
          displayTheme={displayTheme}
          inputLabel="Rename the file"
          saveButtonText="Rename"
          errorMessage={renameFileError}
        />
        <NameFileDialog
          isOpen={openDialog === Dialog.CREATE_FILE}
          handleClose={() =>
            this.setState({openDialog: null, newFileError: null})
          }
          handleSave={this.onCreateFile}
          displayTheme={displayTheme}
          inputLabel="Create new file"
          saveButtonText="Create"
          errorMessage={newFileError}
          filename={DEFAULT_FILE_NAME}
        />
        <CommitDialog
          isOpen={openDialog === Dialog.COMMIT_FILES}
          files={Object.keys(sources)}
          handleClose={() =>
            this.setState({
              openDialog: null,
              compileStatus: CompileStatus.NONE
            })
          }
          handleCommit={onCommitCode}
          compileStatus={compileStatus}
        />
        {openDialog === Dialog.VERSION_HISTORY && (
          <VersionHistoryWithCommitsDialog
            handleClearPuzzle={handleClearPuzzle}
            isProjectTemplateLevel={isProjectTemplateLevel}
            onClose={() => this.setState({openDialog: null})}
            isOpen={openDialog === Dialog.VERSION_HISTORY}
          />
        )}
      </div>
    );
  }
}

const styles = {
  editor: {
    width: '100%',
    minHeight: MIN_HEIGHT,
    backgroundColor: color.white
  },
  darkBackground: {
    backgroundColor: color.darkest_slate_gray
  },
  fileMenuToggleButton: {
    margin: '0, 0, 0, 4px',
    padding: 0,
    height: 20,
    width: 13,
    backgroundColor: 'transparent',
    border: 'none',
    ':hover': {
      cursor: 'pointer',
      boxShadow: 'none'
    }
  },
  darkFileMenuToggleButton: {
    color: color.white
  },
  fileTypeIcon: {
    margin: 5
  },
  tabs: {
    backgroundColor: color.background_gray,
    marginBottom: 0,
    display: 'flex',
    alignItems: 'center'
  },
  backpackSection: {
    textAlign: 'left',
    display: 'inline-block',
    float: 'left',
    overflow: 'visible'
  },
  openCodeReviewWarningBanner: {
    zIndex: 99,
    backgroundColor: color.light_yellow,
    height: 20,
    padding: 5,
    width: '100%',
    color: color.black
  }
};

export default connect(
  state => ({
    sources: state.javalab.sources,
    validation: state.javalab.validation,
    displayTheme: state.javalab.displayTheme,
    isEditingStartSources: state.pageConstants.isEditingStartSources,
    isReadOnlyWorkspace: state.javalab.isReadOnlyWorkspace,
    hasOpenCodeReview: state.javalab.hasOpenCodeReview,
    isViewingOwnProject: state.pageConstants.isViewingOwnProject,
    backpackEnabled: state.javalab.backpackEnabled,
    showProjectTemplateWorkspaceIcon:
      !!state.pageConstants.isProjectTemplateLevel &&
      state.javalab.isReadOnlyWorkspace,
    codeOwnersName: state.pageConstants.codeOwnersName,
    fileMetadata: state.javalab.fileMetadata,
    orderedTabKeys: state.javalab.orderedTabKeys,
    activeTabKey: state.javalab.activeTabKey,
    lastTabKeyIndex: state.javalab.lastTabKeyIndex,
    editTabKey: state.javalab.editTabKey
  }),
  dispatch => ({
    setSource: (filename, source) => dispatch(setSource(filename, source)),
    sourceVisibilityUpdated: (filename, isVisible) =>
      dispatch(sourceVisibilityUpdated(filename, isVisible)),
    sourceValidationUpdated: (filename, isValidation) =>
      dispatch(sourceValidationUpdated(filename, isValidation)),
    sourceTextUpdated: (filename, text) =>
      dispatch(sourceTextUpdated(filename, text)),
    renameFile: (oldFilename, newFilename) =>
      dispatch(renameFile(oldFilename, newFilename)),
    removeFile: filename => dispatch(removeFile(filename)),
    setRenderedHeight: height => dispatch(setRenderedHeight(height)),
    setEditorColumnHeight: height => dispatch(setEditorColumnHeight(height)),
    setEditTabKey: tabKey => dispatch(setEditTabKey(tabKey)),
    setActiveTabKey: tabKey => dispatch(setActiveTabKey(tabKey)),
    setOrderedTabKeys: orderedTabKeys =>
      dispatch(setOrderedTabKeys(orderedTabKeys)),
    setFileMetadata: fileMetadata => dispatch(setFileMetadata(fileMetadata)),
    setAllEditorMetadata: (
      fileMetadata,
      orderedTabKeys,
      activeTabKey,
      lastTabKeyIndex
    ) =>
      dispatch(
        setAllEditorMetadata(
          fileMetadata,
          orderedTabKeys,
          activeTabKey,
          lastTabKeyIndex
        )
      )
  })
)(Radium(JavalabEditor));
