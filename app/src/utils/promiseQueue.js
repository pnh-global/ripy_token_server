/**
 * ============================================
 * promiseQueue.js - 간단한 Promise Queue
 * ============================================
 *
 * 역할:
 * - 여러 개의 비동기 작업을 순차적으로 처리
 * - 동시 실행 개수 제한 (concurrency)
 * - 재시도 로직 포함
 */

/**
 * Promise Queue 클래스
 */
export class PromiseQueue {
    /**
     * @param {number} concurrency - 동시 실행 개수 (기본: 5)
     */
    constructor(concurrency = 5) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }

    /**
     * 작업 추가
     *
     * @param {Function} promiseFn - Promise를 반환하는 함수
     * @returns {Promise} - 작업 완료를 기다리는 Promise
     */
    add(promiseFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                fn: promiseFn,
                resolve,
                reject
            });

            this._process();
        });
    }

    /**
     * 큐 처리 (내부 메서드)
     */
    async _process() {
        if (this.running >= this.concurrency || this.queue.length === 0) {
            return;
        }

        const task = this.queue.shift();
        this.running++;

        try {
            const result = await task.fn();
            task.resolve(result);
        } catch (error) {
            task.reject(error);
        } finally {
            this.running--;
            this._process();
        }
    }

    /**
     * 모든 작업이 완료될 때까지 대기
     *
     * @returns {Promise<void>}
     */
    async waitAll() {
        while (this.running > 0 || this.queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    /**
     * 큐 상태 확인
     *
     * @returns {Object} - { running, pending }
     */
    getStatus() {
        return {
            running: this.running,
            pending: this.queue.length
        };
    }
}

/**
 * 재시도 로직 포함 함수
 *
 * @param {Function} fn - 실행할 함수
 * @param {number} maxRetries - 최대 재시도 횟수 (기본: 3)
 * @param {number} delay - 재시도 간격(ms) (기본: 1000ms)
 * @returns {Promise} - 최종 결과
 */
export async function retryAsync(fn, maxRetries = 3, delay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await fn();
            return result;

        } catch (error) {
            lastError = error;
            console.warn(`[RETRY] 시도 ${attempt}/${maxRetries} 실패:`, error.message);

            if (attempt < maxRetries) {
                await sleep(delay);
            }
        }
    }

    throw new Error(`${maxRetries}번 시도 후 실패: ${lastError.message}`);
}

/**
 * Sleep 함수 (대기)
 *
 * @param {number} ms - 대기 시간(밀리초)
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}