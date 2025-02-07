import React from 'react';
import {UnconnectedStandardsProgressTable as StandardsProgressTable} from './StandardsProgressTable';
import {standardsData, lessonCompletedByStandard} from './standardsTestHelpers';
import {createStore, combineReducers} from 'redux';
import {Provider} from 'react-redux';
import sectionStandardsProgress from './sectionStandardsProgressRedux';
import sectionProgress from '@cdo/apps/templates/sectionProgress/sectionProgressRedux';
import unitSelection from '@cdo/apps/redux/unitSelectionRedux';

export default storybook => {
  const store = createStore(
    combineReducers({
      sectionProgress,
      sectionStandardsProgress,
      unitSelection
    })
  );

  return storybook
    .storiesOf('Standards/StandardsProgressTable', module)
    .addStoryTable([
      {
        name: 'Standards For Class',
        description: 'See standards completed by one class',
        story: () => (
          <Provider store={store}>
            <StandardsProgressTable
              standards={standardsData}
              lessonsByStandard={lessonCompletedByStandard}
            />
          </Provider>
        )
      }
    ]);
};
