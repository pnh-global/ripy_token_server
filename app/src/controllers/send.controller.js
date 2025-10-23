import {
    createCompanySendRequest,
    processCompanySend,
    getCompanySendStatus
} from "../services/send.service.js";

/** POST /api/send/company
 *  - { cate1, cate2, recipients:[{wallet_address_encrypted, amount}, ...] }
 *  - 즉시 request_id 를 응답하고, 백그라운드로 처리 시작
 */
export const postCompanySend = async (req, res) => {
    const { cate1 = "company_send", cate2 = "batch", recipients = [] } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ ok: false, error: "recipients required" });
    }

    const { request_id } = await createCompanySendRequest({ cate1, cate2, recipients });

    // 비동기 처리 kick (await 하지 않음)
    processCompanySend(request_id, {
        ip: req.ip?.toString().replace("::ffff:", ""),
        server: req.headers.host
    }).catch(err => console.error("[company_send]", err));

    res.status(202).json({ ok: true, request_id });
};

/** GET /api/send/company/:request_id
 *  - 진행 상태/집계 반환
 */
export const getCompanySend = async (req, res) => {
    const s = await getCompanySendStatus(req.params.request_id);
    if (!s) return res.status(404).json({ ok: false, error: "not found" });
    res.json({ ok: true, status: s });
};