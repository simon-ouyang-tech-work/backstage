/*
 * Copyright 2021 The Backstage Authors
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

import { ConflictError, NotFoundError } from '@backstage/errors';
import { Knex } from 'knex';
import { Logger } from 'winston';
import { DbTasksRow, DB_TASKS_TABLE } from '../database/tables';
import { LocalTaskWorker } from './LocalTaskWorker';
import { TaskWorker } from './TaskWorker';
import {
  PluginTaskScheduler,
  TaskInvocationDefinition,
  TaskRunner,
  TaskScheduleDefinition,
} from './types';
import { validateId } from './util';

/**
 * Implements the actual task management.
 */
export class PluginTaskSchedulerImpl implements PluginTaskScheduler {
  private readonly localTasks: LocalTaskWorker[];

  constructor(
    private readonly databaseFactory: () => Promise<Knex>,
    private readonly logger: Logger,
  ) {
    this.localTasks = [];
  }

  async triggerTask(id: string): Promise<void> {
    const knex = await this.databaseFactory();

    // check if task exists
    const rows = await knex<DbTasksRow>(DB_TASKS_TABLE)
      .select(knex.raw(1))
      .where('id', '=', id);
    if (rows.length !== 1) {
      throw new NotFoundError(`Task ${id} does not exist`);
    }

    const updatedRows = await knex<DbTasksRow>(DB_TASKS_TABLE)
      .where('id', '=', id)
      .whereNull('current_run_ticket')
      .update({
        next_run_start_at: knex.fn.now(),
      });
    if (updatedRows < 1) {
      throw new ConflictError(`Task ${id} is currently running`);
    }
  }

  async scheduleTask(
    task: TaskScheduleDefinition & TaskInvocationDefinition,
  ): Promise<void> {
    validateId(task.id);

    const knex = await this.databaseFactory();
    const worker = new TaskWorker(task.id, task.fn, knex, this.logger);

    await worker.start(
      {
        version: 2,
        cadence:
          'cron' in task.frequency
            ? task.frequency.cron
            : task.frequency.toISO(),
        initialDelayDuration: task.initialDelay?.toISO(),
        timeoutAfterDuration: task.timeout.toISO(),
      },
      {
        signal: task.signal,
      },
    );
  }

  async scheduleLocalTask(
    task: TaskScheduleDefinition & TaskInvocationDefinition,
  ): Promise<void> {
    validateId(task.id);

    const worker = new LocalTaskWorker(task.id, task.fn, this.logger);

    worker.start(
      {
        version: 2,
        cadence:
          'cron' in task.frequency
            ? task.frequency.cron
            : task.frequency.toISO(),
        initialDelayDuration: task.initialDelay?.toISO(),
        timeoutAfterDuration: task.timeout.toISO(),
      },
      {
        signal: task.signal,
      },
    );

    this.localTasks.push(worker);
  }

  createScheduledTaskRunner(schedule: TaskScheduleDefinition): TaskRunner {
    return {
      run: async task => {
        await this.scheduleTask({ ...task, ...schedule });
      },
    };
  }

  createScheduledLocalTaskRunner(schedule: TaskScheduleDefinition): TaskRunner {
    return {
      run: async task => {
        await this.scheduleLocalTask({ ...task, ...schedule });
      },
    };
  }
}
