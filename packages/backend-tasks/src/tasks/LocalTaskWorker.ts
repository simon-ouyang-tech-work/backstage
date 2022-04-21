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

import { CronTime } from 'cron';
import { DateTime, Duration } from 'luxon';
import { AbortSignal } from 'node-abort-controller';
import { Logger } from 'winston';
import { TaskFunction, TaskSettingsV2 } from './types';
import { delegateAbortController, sleep } from './util';

export class LocalTaskWorker {
  constructor(
    private readonly taskId: string,
    private readonly fn: TaskFunction,
    private readonly logger: Logger,
  ) {}

  start(settings: TaskSettingsV2, options?: { signal?: AbortSignal }) {
    this.logger.info(
      `Task worker starting: ${this.taskId}, ${JSON.stringify(settings)}`,
    );

    (async () => {
      try {
        if (settings.initialDelayDuration) {
          await sleep(
            Duration.fromISO(settings.initialDelayDuration),
            options?.signal,
          );
        }

        while (!options?.signal?.aborted) {
          const startTime = Date.now();
          await this.runOnce(settings, options?.signal);
          const endTime = Date.now();
          await this.waitUntilNext(
            settings,
            endTime - startTime,
            options?.signal,
          );
        }

        this.logger.info(`Task worker finished: ${this.taskId}`);
      } catch (e) {
        this.logger.warn(`Task worker failed unexpectedly, ${e}`);
      }
    })();
  }

  /**
   * Makes a single attempt at running the task to completion.
   */
  async runOnce(settings: TaskSettingsV2, signal?: AbortSignal): Promise<void> {
    // Abort the task execution either if the worker is stopped, or if the
    // task timeout is hit
    const taskAbortController = delegateAbortController(signal);
    const timeoutHandle = setTimeout(() => {
      taskAbortController.abort();
    }, Duration.fromISO(settings.timeoutAfterDuration).as('milliseconds'));

    try {
      await this.fn(taskAbortController.signal);
    } catch (e) {
      // ignore intentionally
    }

    // release resources
    clearTimeout(timeoutHandle);
    taskAbortController.abort();
  }

  /**
   * Sleeps until it's time to run the task again.
   */
  async waitUntilNext(
    settings: TaskSettingsV2,
    lastRunMillis: number,
    signal?: AbortSignal,
  ) {
    if (signal?.aborted) {
      return;
    }

    const isCron = !settings.cadence.startsWith('P');
    let dt: number;

    if (isCron) {
      const nextRun = +new CronTime(settings.cadence).sendAt().toDate();
      dt = Date.now() - nextRun;
    } else {
      dt =
        Duration.fromISO(settings.cadence).as('milliseconds') - lastRunMillis;
    }

    dt = Math.max(dt, 0);

    this.logger.debug(
      `task: ${this.taskId} will next occur around ${DateTime.now().plus(
        Duration.fromMillis(dt),
      )}`,
    );

    if (dt > 0) {
      await sleep(Duration.fromMillis(dt), signal);
    }
  }
}
