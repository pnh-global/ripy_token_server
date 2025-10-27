// src/models/index.js

/**
 * Models Index
 * 모든 모델을 중앙에서 관리하고 export하는 파일
 *
 * 사용 예시:
 * import { contractModel, serviceKeysModel } from '../models/index.js';
 *
 * 또는
 * import * as models from '../models/index.js';
 * models.contractModel.createContract(data);
 */

// 각 모델 파일을 import합니다
import * as contractModel from './contract.model.js';
import * as serviceKeysModel from './serviceKeys.model.js';
import * as blindModel from './blind.model.js';
import * as logModel from './log.model.js';
import * as sendModel from './send.model.js';

// 모든 모델을 하나의 객체로 export합니다
export {
    contractModel,      // r_contract 테이블 관련
    serviceKeysModel,   // service_keys 테이블 관련
    blindModel,         // r_blind 테이블 관련
    logModel,           // r_log 테이블 관련
    sendModel,          // r_send_request, r_send_detail 테이블 관련
};

/**
 * 사용 예시 1: 개별 import
 * -----------------------------------------------
 * import { contractModel } from '../models/index.js';
 *
 * const newContract = await contractModel.createContract({
 *   cate1: 1,
 *   cate2: 1,
 *   owner_id: 'user123',
 *   // ...
 * });
 */

/**
 * 사용 예시 2: 전체 import
 * -----------------------------------------------
 * import * as models from '../models/index.js';
 *
 * const contract = await models.contractModel.getContractById(1);
 * const serviceKey = await models.serviceKeysModel.getServiceKeyById(1);
 */

/**
 * 사용 예시 3: 여러 모델 동시 사용
 * -----------------------------------------------
 * import { contractModel, logModel } from '../models/index.js';
 *
 * // 계약서 생성
 * const contract = await contractModel.createContract(data);
 *
 * // 로그 기록
 * await logModel.createLog({
 *   action: 'CREATE_CONTRACT',
 *   target_id: contract.idx,
 *   // ...
 * });
 */