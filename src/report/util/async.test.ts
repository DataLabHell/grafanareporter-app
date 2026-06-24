/*
 * Copyright 2025 DatalabHell
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

import { runWithConcurrency, throwIfAborted, withAbort } from './async';

describe('throwIfAborted', () => {
  it('throws an AbortError when the signal is aborted', () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => throwIfAborted(controller.signal)).toThrow('Aborted');
  });

  it('does nothing without a signal or when not aborted', () => {
    expect(() => throwIfAborted(undefined)).not.toThrow();
    expect(() => throwIfAborted(new AbortController().signal)).not.toThrow();
  });
});

describe('withAbort', () => {
  it('resolves with the underlying promise value when not aborted', async () => {
    await expect(withAbort(Promise.resolve(42), new AbortController().signal)).resolves.toBe(42);
  });

  it('rejects with AbortError when the signal fires before resolution', async () => {
    const controller = new AbortController();
    const pending = new Promise<number>((resolve) => setTimeout(() => resolve(1), 50));
    const wrapped = withAbort(pending, controller.signal);
    controller.abort();
    await expect(wrapped).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('passes the promise through unchanged without a signal', async () => {
    await expect(withAbort(Promise.resolve('ok'))).resolves.toBe('ok');
  });
});

describe('runWithConcurrency', () => {
  it('processes every item with its index', async () => {
    const seen: Array<[string, number]> = [];
    await runWithConcurrency(['a', 'b', 'c'], 2, async (item, index) => {
      seen.push([item, index]);
    });
    expect(seen.sort()).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
  });

  it('never runs more workers concurrently than the limit', async () => {
    let active = 0;
    let peak = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await runWithConcurrency(items, 3, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('returns immediately for an empty list', async () => {
    const worker = jest.fn();
    await runWithConcurrency([], 4, worker);
    expect(worker).not.toHaveBeenCalled();
  });
});
