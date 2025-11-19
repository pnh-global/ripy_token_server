/**
 * Contract Model
 * r_contract 테이블과 관련된 데이터베이스 작업을 처리하는 모델
 *
 * 테이블 구조:
 * - idx: 고유 ID (Primary Key, Auto Increment)
 * - cate1: 카테고리 1 (varchar 255)
 * - cate2: 카테고리 2 (varchar 255)
 * - sender: 발신자 지갑 주소 (varchar 44)
 * - recipient: 수신자 지갑 주소 (varchar 44)
 * - feepayer: 수수료 대납자 지갑 주소 (varchar 44)
 * - ripy: RIPY 토큰 수량 (decimal 38,18)
 * - signed_or_not1: 발신자 서명 여부 (enum: N, Y)
 * - signed_or_not2: 수신자 서명 여부 (enum: N, Y)
 * - created_at: 생성 시각 (datetime)
 * - updated_at: 수정 시각 (datetime)
 */

import { pool } from '../config/db.js';

/**
 * 새로운 계약서를 생성합니다
 *
 * @param {Object} data - 계약서 데이터
 * @param {string} data.cate1 - 카테고리 1
 * @param {string} data.cate2 - 카테고리 2
 * @param {string} data.sender - 발신자 지갑 주소
 * @param {string} data.recipient - 수신자 지갑 주소
 * @param {string} data.feepayer - 수수료 대납자 지갑 주소
 * @param {string|number} data.ripy - RIPY 토큰 수량
 * @param {string} [data.signed_or_not1='N'] - 발신자 서명 여부 (기본값: 'N')
 * @param {string} [data.signed_or_not2='N'] - 수신자 서명 여부 (기본값: 'N')
 * @returns {Promise<Object>} 생성된 계약서 정보 (idx 포함)
 *
 * @example
 * const contract = await createContract({
 *   cate1: '1',
 *   cate2: '1',
 *   sender: 'SenderWalletAddress123...',
 *   recipient: 'RecipientWalletAddress456...',
 *   feepayer: 'FeepayerWalletAddress789...',
 *   ripy: '100.5',
 * });
 * // 결과: { idx: 1, cate1: '1', cate2: '1', ... }
 */
export async function createContract(data) {
    // SQL INSERT 쿼리문
    // :cate1, :sender 같은 형태는 Named Placeholder입니다
    // 이렇게 사용하면 SQL Injection 공격을 방어할 수 있습니다
    const query = `
    INSERT INTO r_contract (
      cate1,
      cate2,
      sender,
      recipient,
      feepayer,
      ripy,
      signed_or_not1,
      signed_or_not2,
      created_at,
      updated_at
    ) VALUES (
      :cate1,
      :cate2,
      :sender,
      :recipient,
      :feepayer,
      :ripy,
      :signed_or_not1,
      :signed_or_not2,
      NOW(),
      NOW()
    )
  `;

    // 실제로 데이터베이스에 INSERT 실행
    // pool.execute는 두 번째 파라미터로 데이터를 받습니다
    const [result] = await pool.execute(query, {
        cate1: data.cate1,
        cate2: data.cate2,
        sender: data.sender,
        recipient: data.recipient,
        feepayer: data.feepayer,
        ripy: data.ripy,
        signed_or_not1: data.signed_or_not1 || 'N', // 기본값 'N'
        signed_or_not2: data.signed_or_not2 || 'N', // 기본값 'N'
    });

    // 방금 생성된 행의 idx(Primary Key)를 가져옵니다
    const insertId = result.insertId;

    // 생성된 계약서를 다시 조회해서 반환합니다
    return await getContractById(insertId);
}

/**
 * idx로 계약서를 조회합니다
 *
 * @param {number} idx - 조회할 계약서의 idx
 * @returns {Promise<Object|null>} 계약서 정보 또는 null (없을 경우)
 *
 * @example
 * const contract = await getContractById(1);
 * if (!contract) {
 *   console.log('계약서를 찾을 수 없습니다');
 * } else {
 *   console.log(contract.sender); // 발신자 주소 출력
 * }
 */
export async function getContractById(idx) {
    const query = `
    SELECT 
      idx,
      cate1,
      cate2,
      sender,
      recipient,
      feepayer,
      ripy,
      signed_or_not1,
      signed_or_not2,
      created_at,
      updated_at
    FROM r_contract
    WHERE idx = :idx
  `;

    // pool.execute는 배열 형태로 [rows, fields]를 반환합니다
    // 우리는 rows만 필요하므로 구조 분해 할당을 사용합니다
    const [rows] = await pool.execute(query, { idx });

    // rows[0]이 없으면 null을 반환 (해당 idx의 데이터가 없음)
    // rows[0]이 있으면 그 객체를 반환
    return rows[0] || null;
}

/**
 * 계약서 정보를 업데이트합니다
 *
 * @param {number} idx - 업데이트할 계약서의 idx
 * @param {Object} data - 업데이트할 필드들
 * @param {string} [data.cate1] - 카테고리 1
 * @param {string} [data.cate2] - 카테고리 2
 * @param {string} [data.sender] - 발신자 지갑 주소
 * @param {string} [data.recipient] - 수신자 지갑 주소
 * @param {string} [data.feepayer] - 수수료 대납자 지갑 주소
 * @param {string|number} [data.ripy] - RIPY 토큰 수량
 * @param {string} [data.signed_or_not1] - 발신자 서명 여부
 * @param {string} [data.signed_or_not2] - 수신자 서명 여부
 * @returns {Promise<Object>} 업데이트된 계약서 정보
 *
 * @example
 * // 발신자 서명을 'Y'로 변경
 * const updated = await updateContract(1, {
 *   signed_or_not1: 'Y'
 * });
 */
export async function updateContract(idx, data) {
    // 업데이트할 필드들을 동적으로 구성합니다
    // 예: data = { signed_or_not1: 'Y', ripy: '200' }
    // 결과: ["signed_or_not1 = :signed_or_not1", "ripy = :ripy"]
    const fields = Object.keys(data).map(key => `${key} = :${key}`);

    // 배열을 ', '로 연결
    // 예: "signed_or_not1 = :signed_or_not1, ripy = :ripy"
    const setClause = fields.join(', ');

    // 최종 SQL 쿼리
    const query = `
    UPDATE r_contract
    SET ${setClause}, updated_at = NOW()
    WHERE idx = :idx
  `;

    // data 객체에 idx를 추가해서 한 번에 전달
    await pool.execute(query, { ...data, idx });

    // 업데이트된 계약서를 다시 조회해서 반환
    return await getContractById(idx);
}

/**
 * 계약서 목록을 조회합니다 (페이징, 필터링 지원)
 *
 * @param {Object} [filters={}] - 필터 조건
 * @param {string} [filters.cate1] - 카테고리 1로 필터링
 * @param {string} [filters.cate2] - 카테고리 2로 필터링
 * @param {string} [filters.sender] - 발신자 주소로 필터링
 * @param {string} [filters.recipient] - 수신자 주소로 필터링
 * @param {number} [filters.page=1] - 페이지 번호 (1부터 시작)
 * @param {number} [filters.limit=10] - 페이지당 항목 수
 * @param {string} [filters.orderBy='idx'] - 정렬 기준 컬럼
 * @param {string} [filters.orderDir='DESC'] - 정렬 방향 (ASC 또는 DESC)
 * @returns {Promise<Object>} { data: 계약서 배열, total: 전체 개수, page, limit }
 *
 * @example
 * // 첫 페이지 10개 조회
 * const result = await listContracts({ page: 1, limit: 10 });
 * console.log(result.data); // 계약서 배열
 * console.log(result.total); // 전체 개수
 *
 * // 카테고리 1이 '1'인 계약서만 조회
 * const filtered = await listContracts({ cate1: '1', page: 1, limit: 10 });
 */
export async function listContracts(filters = {}) {
    // 기본값 설정
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const orderBy = filters.orderBy || 'idx';
    const orderDir = filters.orderDir || 'DESC';

    // OFFSET 계산
    // 예: page=1, limit=10 → offset=0 (0~9번째)
    // 예: page=2, limit=10 → offset=10 (10~19번째)
    const offset = (page - 1) * limit;

    // WHERE 절을 동적으로 생성
    const conditions = []; // 조건들을 담을 배열
    const params = {}; // Named Placeholder에 전달할 값들

    // cate1 필터가 있으면 조건 추가
    if (filters.cate1) {
        conditions.push('cate1 = :cate1');
        params.cate1 = filters.cate1;
    }

    // cate2 필터가 있으면 조건 추가
    if (filters.cate2) {
        conditions.push('cate2 = :cate2');
        params.cate2 = filters.cate2;
    }

    // sender 필터가 있으면 조건 추가
    if (filters.sender) {
        conditions.push('sender = :sender');
        params.sender = filters.sender;
    }

    // recipient 필터가 있으면 조건 추가
    if (filters.recipient) {
        conditions.push('recipient = :recipient');
        params.recipient = filters.recipient;
    }

    // WHERE 절 완성
    // 조건이 있으면 'WHERE ...' 형태로, 없으면 빈 문자열
    const whereClause = conditions.length > 0
        ? 'WHERE ' + conditions.join(' AND ')
        : '';

    // 전체 개수 조회 쿼리
    const countQuery = `
    SELECT COUNT(*) as total
    FROM r_contract
    ${whereClause}
  `;

    // 데이터 조회 쿼리 (페이징 적용)
    const dataQuery = `
    SELECT 
      idx,
      cate1,
      cate2,
      sender,
      recipient,
      feepayer,
      ripy,
      signed_or_not1,
      signed_or_not2,
      created_at,
      updated_at
    FROM r_contract
    ${whereClause}
    ORDER BY ${orderBy} ${orderDir}
    LIMIT :limit OFFSET :offset
  `;

    // 전체 개수 조회
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    // 데이터 조회 (LIMIT, OFFSET 파라미터 추가)
    const [dataRows] = await pool.execute(dataQuery, {
        ...params,
        limit,
        offset,
    });

    // 결과 반환
    return {
        data: dataRows,      // 계약서 배열
        total,               // 전체 개수
        page,                // 현재 페이지
        limit,               // 페이지당 항목 수
        totalPages: Math.ceil(total / limit), // 전체 페이지 수
    };
}