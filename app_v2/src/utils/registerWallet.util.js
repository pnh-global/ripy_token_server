/**
 * Wallet Registration Utility
 * 지갑 정보를 암호화하여 데이터베이스에 등록하는 유틸리티
 */

import crypto from "crypto";
import pool from "../config/db.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Private Key 암호화
 *
 * @param {string} privateKey - Private Key (JSON 배열 문자열)
 * @returns {string} 암호화된 Private Key (Base64)
 */
function encryptPrivateKey(privateKey) {
    try {
        const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
        const iv = Buffer.from(process.env.ENCRYPTION_IV, "hex");

        const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

        let encrypted = cipher.update(privateKey, "utf8", "base64");
        encrypted += cipher.final("base64");

        return encrypted;

    } catch (error) {
        throw new Error(`암호화 실패: ${error.message}`);
    }
}

/**
 * 지갑 등록 함수
 *
 * @param {string} walletAddress - 지갑 공개 주소
 * @param {string} privateKey - Private Key (JSON 배열 문자열, 예: "[123,45,67,...]")
 * @param {string} walletType - 지갑 타입 (user, master, service)
 * @returns {Promise<object>} 등록 결과
 */
export async function registerWallet(walletAddress, privateKey, walletType = "user") {
    let connection = null;

    try {
        console.log("[지갑 등록] 시작:", walletAddress);

        // 1. 입력값 검증
        if (!walletAddress || walletAddress.length < 32 || walletAddress.length > 44) {
            throw new Error("유효하지 않은 지갑 주소입니다.");
        }

        if (!privateKey) {
            throw new Error("Private Key가 제공되지 않았습니다.");
        }

        // Private Key가 JSON 배열 형식인지 확인
        try {
            JSON.parse(privateKey);
        } catch (e) {
            throw new Error("Private Key는 JSON 배열 형식이어야 합니다. 예: \"[123,45,67,...]\"");
        }

        if (!["user", "master", "service"].includes(walletType)) {
            throw new Error("walletType은 user, master, service 중 하나여야 합니다.");
        }

        // 2. Private Key 암호화
        const encryptedPrivateKey = encryptPrivateKey(privateKey);

        console.log("[지갑 등록] Private Key 암호화 완료");

        // 3. 데이터베이스 연결
        connection = await pool.getConnection();

        // 4. 기존 지갑 존재 여부 확인
        const [existing] = await connection.query(
            "SELECT id FROM wallets WHERE wallet_address = ?",
            [walletAddress]
        );

        if (existing.length > 0) {
            throw new Error(`이미 등록된 지갑입니다: ${walletAddress}`);
        }

        // 5. 지갑 정보 저장
        const [result] = await connection.query(
            `INSERT INTO wallets 
            (wallet_address, encrypted_private_key, wallet_type, is_active, created_at)
            VALUES (?, ?, ?, 1, NOW())`,
            [walletAddress, encryptedPrivateKey, walletType]
        );

        console.log("[지갑 등록] 데이터베이스 저장 완료:", result.insertId);

        return {
            success: true,
            wallet_id: result.insertId,
            wallet_address: walletAddress,
            wallet_type: walletType,
            message: "지갑이 성공적으로 등록되었습니다."
        };

    } catch (error) {
        console.error("[지갑 등록] 에러:", error);
        throw error;

    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/**
 * 지갑 목록 조회
 *
 * @returns {Promise<Array>} 지갑 목록
 */
export async function listWallets() {
    try {
        const [rows] = await pool.query(
            `SELECT 
                id,
                wallet_address,
                wallet_type,
                is_active,
                created_at,
                updated_at
            FROM wallets
            ORDER BY created_at DESC`
        );

        return {
            success: true,
            wallets: rows,
            count: rows.length
        };

    } catch (error) {
        console.error("[지갑 목록 조회] 에러:", error);
        throw error;
    }
}

/**
 * 지갑 삭제 (비활성화)
 *
 * @param {string} walletAddress - 지갑 주소
 * @returns {Promise<object>} 삭제 결과
 */
export async function deactivateWallet(walletAddress) {
    try {
        const [result] = await pool.query(
            "UPDATE wallets SET is_active = 0, updated_at = NOW() WHERE wallet_address = ?",
            [walletAddress]
        );

        if (result.affectedRows === 0) {
            throw new Error(`지갑을 찾을 수 없습니다: ${walletAddress}`);
        }

        return {
            success: true,
            wallet_address: walletAddress,
            message: "지갑이 비활성화되었습니다."
        };

    } catch (error) {
        console.error("[지갑 비활성화] 에러:", error);
        throw error;
    }
}