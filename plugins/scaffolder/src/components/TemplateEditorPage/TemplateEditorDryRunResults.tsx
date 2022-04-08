/*
 * Copyright 2022 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  makeStyles,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Tabs,
  Tab,
} from '@material-ui/core';
import React, { useEffect, useState } from 'react';
import { useDryRun } from './DryRunContext';
import DeleteIcon from '@material-ui/icons/Delete';
import ExpandMoreIcon from '@material-ui/icons/ExpandLess';
import { FileBrowser } from './FileBrowser';
import CodeMirror from '@uiw/react-codemirror';
import { yaml as yamlSupport } from '@codemirror/legacy-modes/mode/yaml';
import { StreamLanguage } from '@codemirror/stream-parser';
import { LogViewer } from '@backstage/core-components';
import { usePrevious } from '@react-hookz/web';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'grid',
    gridTemplateColumns: '200px 1fr',
    gridTemplateRows: '1fr',
    padding: 0,
    height: 400,
  },
  header: {
    height: 40,
    minHeight: 0,
    '&.Mui-expanded': {
      height: 40,
      minHeight: 0,
    },
  },
  resultView: {
    display: 'flex',
    flexFlow: 'column nowrap',
  },
  fileViewer: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 3fr',
    gridTemplateRows: '1fr',
  },
  fileViewerCodeMirror: {
    // height: '100%',
  },
}));

export function TemplateEditorDryRunResults() {
  const classes = useStyles();
  const dryRun = useDryRun();
  const [expanded, setExpanded] = useState(false);

  const resultsLength = dryRun.results.length;
  const prevResultsLength = usePrevious(resultsLength);
  useEffect(() => {
    if (prevResultsLength === 0 && resultsLength === 1) {
      setExpanded(true);
    }
  }, [prevResultsLength, resultsLength]);

  return (
    <>
      <Accordion
        expanded={expanded}
        onChange={(_, exp) => setExpanded(exp)}
        variant="outlined"
      >
        <AccordionSummary
          className={classes.header}
          expandIcon={<ExpandMoreIcon />}
        >
          <Typography>Dry-run results</Typography>
        </AccordionSummary>
        <Divider orientation="horizontal" />
        <AccordionDetails className={classes.root}>
          <ResultList />
          <ResultView />
        </AccordionDetails>
      </Accordion>
    </>
  );
}

function ResultList() {
  const dryRun = useDryRun();
  return (
    <List dense style={{ overflowY: 'scroll' }}>
      {dryRun.results.map(result => (
        <ListItem
          button
          key={result.id}
          selected={dryRun.selectedResult?.id === result.id}
          onClick={() => dryRun.selectResult(result.id)}
        >
          <ListItemText primary={`Result ${result.id}`} />
          <ListItemSecondaryAction>
            <IconButton
              edge="end"
              aria-label="delete"
              onClick={() => dryRun.deleteResult(result.id)}
            >
              <DeleteIcon />
            </IconButton>
          </ListItemSecondaryAction>
        </ListItem>
      ))}
    </List>
  );
}

function ResultView() {
  const classes = useStyles();
  const dryRun = useDryRun();
  const [selectedTab, setSelectedTab] = useState<'files' | 'log' | 'output'>(
    'files',
  );

  return (
    <div className={classes.resultView}>
      <Tabs value={selectedTab} onChange={(_, v) => setSelectedTab(v)}>
        <Tab value="files" label="Files" />
        <Tab value="log" label="Log" />
        <Tab value="output" label="Output" />
      </Tabs>
      <Divider />
      {selectedTab === 'files' && <FilesContent />}
      {selectedTab === 'log' && <LogContent />}
      {selectedTab === 'output' && <OutputContent />}
    </div>
  );
}

function FilesContent() {
  const classes = useStyles();
  const { selectedResult } = useDryRun();
  const [selectedPath, setSelectedPath] = useState<string>('');
  const selectedFile = selectedResult?.content.find(
    f => f.path === selectedPath,
  );

  useEffect(() => {
    if (selectedResult) {
      const [firstFile] = selectedResult.content;
      if (firstFile) {
        setSelectedPath(firstFile.path);
      } else {
        setSelectedPath('');
      }
    }
    return undefined;
  }, [selectedResult]);

  if (!selectedResult) {
    return null;
  }
  return (
    <div className={classes.fileViewer}>
      <FileBrowser
        selected={selectedPath}
        onSelect={setSelectedPath}
        filePaths={selectedResult.content.map(file => file.path)}
      />
      <CodeMirror
        className={classes.fileViewerCodeMirror}
        theme="dark"
        height="100%"
        extensions={[StreamLanguage.define(yamlSupport)]}
        value={
          selectedFile?.base64Content ? atob(selectedFile.base64Content) : ''
        }
      />
    </div>
  );
}
function LogContent() {
  const { selectedResult } = useDryRun();
  if (!selectedResult) {
    return null;
  }
  return (
    <div style={{ height: '100%' }}>
      <LogViewer text={selectedResult.log.map(m => m.message).join('\n')} />
    </div>
  );
}
function OutputContent() {
  return <div>OutputViewer</div>;
}
