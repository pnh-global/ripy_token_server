// src/models/blind.model.js

import { pool } from '../config/db.js';

const blindModel = {

    async addBlindIp(data) {
        if (!data.ip_address) {
            throw new Error('ip_address is required');
        }

        try {
            // 1단계: INET_ATON() 먼저 실행하여 바이너리 값 얻기
            const [converted] = await pool.execute(
                `SELECT INET_ATON(:ip) as binary_ip`,
                { ip: data.ip_address }
            );

            const binaryIp = converted[0].binary_ip;

            if (binaryIp === null) {
                throw new Error(`Invalid IP address: ${data.ip_address}`);
            }

            // 2단계: 변환된 바이너리 값으로 INSERT
            const [result] = await pool.execute(
                `INSERT INTO r_blind (req_ip, req_ip_text, expired_at, created_at)
                 VALUES (:binary_ip, :ip_text, :expired_at, NOW())`,
                {
                    binary_ip: binaryIp,
                    ip_text: data.ip_address,  // ← 항상 IP 주소 저장
                    expired_at: data.expired_at || null
                }
            );

            return {
                idx: result.insertId,
                affectedRows: result.affectedRows
            };

        } catch (error) {
            console.error('Error in addBlindIp:', error);
            console.error('Parameters:', data);
            throw error;
        }
    },

    async checkBlindIp(ip) {
        if (!ip) {
            throw new Error('IP address is required');
        }

        try {
            // 1단계: INET_ATON() 먼저 실행
            const [converted] = await pool.execute(
                `SELECT INET_ATON(:ip) as binary_ip`,
                { ip }
            );

            const binaryIp = converted[0].binary_ip;

            if (binaryIp === null) {
                throw new Error(`Invalid IP address: ${ip}`);
            }

            // 2단계: 변환된 값으로 검색
            const [rows] = await pool.execute(
                `SELECT idx 
         FROM r_blind 
         WHERE req_ip = :binary_ip 
         AND (expired_at IS NULL OR expired_at > NOW())
         LIMIT 1`,
                { binary_ip: binaryIp }
            );

            return rows.length > 0;

        } catch (error) {
            console.error('Error in checkBlindIp:', error);
            throw error;
        }
    },

    async removeExpiredBlinds() {
        try {
            const [result] = await pool.execute(
                `DELETE FROM r_blind 
         WHERE expired_at IS NOT NULL 
         AND expired_at < NOW()`
            );

            return {
                affectedRows: result.affectedRows
            };

        } catch (error) {
            console.error('Error in removeExpiredBlinds:', error);
            throw error;
        }
    }

};

export default blindModel;