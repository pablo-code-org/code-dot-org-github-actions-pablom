import PropTypes from 'prop-types';
import React, {useEffect, useState} from 'react';
import TextareaWithMarkdownPreview from '@cdo/apps/lib/levelbuilder/TextareaWithMarkdownPreview';
import SaveBar from '@cdo/apps/lib/levelbuilder/SaveBar';
import {navigateToHref} from '@cdo/apps/utils';
import $ from 'jquery';
import color from '@cdo/apps/util/color';

export default function ProgrammingExpressionEditor({
  initialProgrammingExpression
}) {
  const [name, setName] = useState(initialProgrammingExpression.name);
  const [shortDescription, setShortDescription] = useState(
    initialProgrammingExpression.shortDescription
  );
  const [isSaving, setIsSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(
    initialProgrammingExpression.lastUpdated
  );
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isSaving) {
      fetch(`/programming_expressions/${initialProgrammingExpression.id}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'X-CSRF-Token': $('meta[name="csrf-token"]').attr('content')
        },
        body: JSON.stringify({
          id: initialProgrammingExpression.id,
          name: name,
          shortDescription: shortDescription
        })
      })
        .then(response => {
          if (response.ok) {
            setIsSaving(false);
            setLastUpdated(Date.now());
          } else {
            setIsSaving(false);
            setError(response.statusText);
          }
        })
        .catch(error => {
          setIsSaving(false);
          setError(error.responseText);
        });
    }
  }, [isSaving]);

  return (
    <div>
      <h1>{`Editing ${initialProgrammingExpression.name}`}</h1>
      <h2>
        This feature is in development. Please continue to use curriculum
        builder to edit code documentation.
      </h2>
      <label>
        Display Name
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          style={styles.textInput}
        />
      </label>
      <label>
        Key (Used in URLs)
        <input
          value={initialProgrammingExpression.key}
          readOnly
          style={styles.textInput}
        />
      </label>
      <TextareaWithMarkdownPreview
        markdown={shortDescription}
        label={'Short Description'}
        handleMarkdownChange={e => setShortDescription(e.target.value)}
        features={{
          imageUpload: true
        }}
      />
      <SaveBar
        handleSave={() => setIsSaving(true)}
        isSaving={isSaving}
        lastSaved={lastUpdated}
        error={error}
        handleView={() => navigateToHref('/')}
      />
    </div>
  );
}

const programmingExpressionShape = PropTypes.shape({
  id: PropTypes.number.isRequired,
  key: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  shortDescription: PropTypes.string
});

ProgrammingExpressionEditor.propTypes = {
  initialProgrammingExpression: programmingExpressionShape.isRequired
};

const styles = {
  textInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '4px 6px',
    color: '#555',
    border: `1px solid ${color.bootstrap_border_color}`,
    borderRadius: 4,
    margin: 0
  },
  selectInput: {
    boxSizing: 'border-box',
    padding: '4px 6px',
    color: '#555',
    border: `1px solid ${color.bootstrap_border_color}`,
    borderRadius: 4,
    marginLeft: 5
  }
};
