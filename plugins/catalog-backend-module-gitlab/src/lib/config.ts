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
  GitLabIntegration,
  GitLabIntegrationConfig,
} from '@backstage/integration';

type FindIntegrationByURL = (
  url: string | URL,
) => GitLabIntegration | undefined;

export function groupByIntegrationConfig(
  byUrl: FindIntegrationByURL,
  providerConfigs: GitLabOrgProviderConfig[],
): Map<GitLabIntegrationConfig, GitLabOrgProviderConfig[]> {
  const mapping = new Map<GitLabIntegrationConfig, GitLabOrgProviderConfig[]>();

  for (const config of providerConfigs) {
    const integrationConfig = getIntegrationConfig(byUrl, config.target);
    const providers = mapping.get(integrationConfig);
    if (providers) {
      providers.push(config);
    } else {
      mapping.set(integrationConfig, [config]);
    }
  }

  return mapping;
}

function getIntegrationConfig(
  byUrl: FindIntegrationByURL,
  target: string,
): GitLabIntegrationConfig {
  const config = byUrl(target)?.config;
  if (!config) {
    throw new Error(
      `There is no GitLab integration for ${target}. Please add a configuration for an integration.`,
    );
  }
  return config;
}
