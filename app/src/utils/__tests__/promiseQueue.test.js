// src/utils/__tests__/promiseQueue.test.js

/**
 * ============================================
 * promiseQueue.test.js - Promise Queue 테스트
 * ============================================
 */

import { PromiseQueue, retryAsync } from '../promiseQueue.js';

describe('PromiseQueue 유틸리티 테스트', () => {

    // ============================================
    // 1. PromiseQueue 기본 기능 테스트
    // ============================================
    describe('PromiseQueue - 기본 기능', () => {

        test('Queue 생성 및 초기 상태 확인', () => {
            // Given: Queue 생성
            const queue = new PromiseQueue();

            // When: 상태 확인
            const status = queue.getStatus();

            // Then: 초기 상태는 running=0, pending=0
            expect(status).toEqual({
                running: 0,
                pending: 0
            });
        });

        test('단일 작업 추가 및 실행', async () => {
            // Given: Queue와 작업
            const queue = new PromiseQueue();
            let callCount = 0;
            const mockTask = async () => {
                callCount++;
                return 'success';
            };

            // When: 작업 추가 및 실행
            const result = await queue.add(mockTask);

            // Then: 작업이 실행되고 결과 반환
            expect(callCount).toBe(1);
            expect(result).toBe('success');
        });

        test('여러 작업 순차 실행', async () => {
            // Given: Queue와 여러 작업
            const queue = new PromiseQueue(1); // concurrency=1로 순차 실행 보장
            const results = [];

            const task1 = async () => {
                await sleep(50);
                results.push(1);
                return 1;
            };

            const task2 = async () => {
                await sleep(30);
                results.push(2);
                return 2;
            };

            const task3 = async () => {
                await sleep(10);
                results.push(3);
                return 3;
            };

            // When: 작업들을 추가
            const promises = [
                queue.add(task1),
                queue.add(task2),
                queue.add(task3)
            ];

            await Promise.all(promises);

            // Then: 순차적으로 실행됨 (1 -> 2 -> 3)
            expect(results).toEqual([1, 2, 3]);
        });

        test('Concurrency 제어 (동시 실행 개수 제한)', async () => {
            // Given: concurrency=2인 Queue
            const queue = new PromiseQueue(2);
            let runningCount = 0;
            let maxRunning = 0;

            const createTask = (id) => async () => {
                runningCount++;
                maxRunning = Math.max(maxRunning, runningCount);
                await sleep(50);
                runningCount--;
                return id;
            };

            // When: 5개 작업 추가
            const promises = [
                queue.add(createTask(1)),
                queue.add(createTask(2)),
                queue.add(createTask(3)),
                queue.add(createTask(4)),
                queue.add(createTask(5))
            ];

            await Promise.all(promises);

            // Then: 최대 2개까지만 동시 실행
            expect(maxRunning).toBe(2);
        });

        test('작업 실패 시 reject', async () => {
            // Given: Queue와 실패하는 작업
            const queue = new PromiseQueue();
            let callCount = 0;
            const errorTask = async () => {
                callCount++;
                throw new Error('Task failed');
            };

            // When & Then: 작업 실패 시 에러 전파
            await expect(queue.add(errorTask)).rejects.toThrow('Task failed');
            expect(callCount).toBe(1);
        });
    });

    // ============================================
    // 2. getStatus 테스트
    // ============================================
    describe('getStatus - 큐 상태 확인', () => {

        test('작업 실행 중 상태 확인', async () => {
            // Given: Queue와 긴 작업
            const queue = new PromiseQueue(1);

            const longTask = () => sleep(100);

            // When: 여러 작업 추가
            queue.add(longTask);
            queue.add(longTask);
            queue.add(longTask);

            // 잠시 대기 후 상태 확인
            await sleep(10);
            const status = queue.getStatus();

            // Then: running=1, pending=2
            expect(status.running).toBe(1);
            expect(status.pending).toBe(2);
        });

        test('모든 작업 완료 후 상태', async () => {
            // Given: Queue와 작업들
            const queue = new PromiseQueue();
            const task = () => Promise.resolve('done');

            // When: 작업 추가 및 완료 대기
            await Promise.all([
                queue.add(task),
                queue.add(task),
                queue.add(task)
            ]);

            const status = queue.getStatus();

            // Then: running=0, pending=0
            expect(status).toEqual({
                running: 0,
                pending: 0
            });
        });
    });

    // ============================================
    // 3. waitAll 테스트
    // ============================================
    describe('waitAll - 모든 작업 완료 대기', () => {

        test('모든 작업 완료까지 대기', async () => {
            // Given: Queue와 여러 작업
            const queue = new PromiseQueue(2);
            const results = [];

            const createTask = (id, delay) => async () => {
                await sleep(delay);
                results.push(id);
            };

            // When: 작업 추가 (반환값 저장 안 함)
            queue.add(createTask(1, 50));
            queue.add(createTask(2, 100));
            queue.add(createTask(3, 30));

            // waitAll로 모든 작업 완료 대기
            await queue.waitAll();

            // Then: 모든 작업 완료
            expect(results.length).toBe(3);
            expect(results).toContain(1);
            expect(results).toContain(2);
            expect(results).toContain(3);
        });

        test('빈 큐에서 waitAll은 즉시 반환', async () => {
            // Given: 빈 Queue
            const queue = new PromiseQueue();

            // When: waitAll 호출
            const startTime = Date.now();
            await queue.waitAll();
            const elapsedTime = Date.now() - startTime;

            // Then: 거의 즉시 반환 (100ms 이하)
            expect(elapsedTime).toBeLessThan(100);
        });
    });

    // ============================================
    // 4. retryAsync 테스트
    // ============================================
    describe('retryAsync - 재시도 로직', () => {

        test('첫 시도에 성공하면 즉시 반환', async () => {
            // Given: 성공하는 함수
            let callCount = 0;
            const successFn = async () => {
                callCount++;
                return 'success';
            };

            // When: retryAsync 실행
            const result = await retryAsync(successFn, 3, 10);

            // Then: 1번만 호출되고 성공
            expect(callCount).toBe(1);
            expect(result).toBe('success');
        });

        test('두 번째 시도에 성공', async () => {
            // Given: 첫 번째 실패, 두 번째 성공하는 함수
            let attemptCount = 0;
            const retryFn = async () => {
                attemptCount++;
                if (attemptCount === 1) {
                    throw new Error('First fail');
                }
                return 'success';
            };

            // When: retryAsync 실행
            const result = await retryAsync(retryFn, 3, 10);

            // Then: 2번 호출되고 성공
            expect(attemptCount).toBe(2);
            expect(result).toBe('success');
        });

        test('최대 재시도 횟수만큼 시도', async () => {
            // Given: 계속 실패하는 함수
            let callCount = 0;
            const failFn = async () => {
                callCount++;
                throw new Error('Always fail');
            };

            // When & Then: 최대 3번 시도 후 최종 실패
            await expect(
                retryAsync(failFn, 3, 10)
            ).rejects.toThrow('3번 시도 후 실패');

            expect(callCount).toBe(3);
        });

        test('재시도 간격(delay) 확인', async () => {
            // Given: 계속 실패하는 함수
            const failFn = async () => {
                throw new Error('Fail');
            };

            // When: 재시도 (delay=50ms)
            const startTime = Date.now();

            try {
                await retryAsync(failFn, 3, 50);
            } catch (error) {
                // 에러 예상
            }

            const elapsedTime = Date.now() - startTime;

            // Then: 총 2번의 delay (50ms * 2 = 100ms) 이상 소요
            // 약간의 오차 허용 (80ms 이상)
            expect(elapsedTime).toBeGreaterThanOrEqual(80);
        });

        test('기본 재시도 설정 사용', async () => {
            // Given: 계속 실패하는 함수
            let callCount = 0;
            const failFn = async () => {
                callCount++;
                throw new Error('Fail');
            };

            // When: 기본값으로 retryAsync 실행 (maxRetries=3)
            try {
                await retryAsync(failFn);
            } catch (error) {
                // 에러 예상
            }

            // Then: 기본 3번 시도
            expect(callCount).toBe(3);
        });
    });

    // ============================================
    // 5. 통합 시나리오 테스트
    // ============================================
    describe('통합 시나리오', () => {

        test('Queue + Retry 조합 사용', async () => {
            // Given: Queue와 실패 가능한 작업들
            const queue = new PromiseQueue(2);
            let attemptCount = 0;

            // 처음 2번 실패, 3번째 성공하는 작업
            const unreliableTask = async () => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new Error('Temporary failure');
                }
                return 'success';
            };

            // When: Queue에 retry 포함 작업 추가
            const result = await queue.add(() => retryAsync(unreliableTask, 5, 10));

            // Then: 재시도 후 성공
            expect(result).toBe('success');
            expect(attemptCount).toBe(3);
        });

        test('대량 작업 처리 시나리오', async () => {
            // Given: Queue와 많은 작업들
            const queue = new PromiseQueue(5); // 동시 5개
            const taskCount = 20;
            const results = [];

            const createTask = (id) => async () => {
                await sleep(Math.random() * 50); // 랜덤 지연
                results.push(id);
                return id;
            };

            // When: 20개 작업 추가
            const promises = [];
            for (let i = 1; i <= taskCount; i++) {
                promises.push(queue.add(createTask(i)));
            }

            await Promise.all(promises);

            // Then: 모든 작업 완료
            expect(results.length).toBe(taskCount);
            expect(results.sort((a, b) => a - b)).toEqual(
                Array.from({ length: taskCount }, (_, i) => i + 1)
            );
        });

        test('에러 발생 시 다른 작업은 계속 진행', async () => {
            // Given: Queue와 성공/실패 작업
            const queue = new PromiseQueue(2);
            const results = [];

            const successTask = async (id) => {
                await sleep(30);
                results.push(id);
                return id;
            };

            const failTask = async () => {
                await sleep(10);
                throw new Error('Task error');
            };

            // When: 작업들 추가
            const promises = [
                queue.add(() => successTask(1)),
                queue.add(failTask),
                queue.add(() => successTask(2)),
                queue.add(() => successTask(3))
            ];

            // Then: 실패한 작업만 에러, 나머지는 성공
            const settled = await Promise.allSettled(promises);

            expect(settled[0].status).toBe('fulfilled');
            expect(settled[1].status).toBe('rejected');
            expect(settled[2].status).toBe('fulfilled');
            expect(settled[3].status).toBe('fulfilled');

            expect(results).toEqual([1, 2, 3]);
        });
    });
});

// ============================================
// 헬퍼 함수
// ============================================

/**
 * Sleep 함수 (테스트용)
 * @param {number} ms - 대기 시간(밀리초)
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}