const db = require('../config/db');
const { successRes, errorRes } = require('../utils/response');
const { logAction } = require('../utils/logger');

const getOffers = async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM selection_offers ORDER BY created_at DESC`);

    const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
    const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

    const colors = ['navy', 'gold', 'green', 'red', 'purple', 'teal'];

    const offers = rows.map((r) => {
      const initials = r.name.split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
      const colorIndex = (r.name.charCodeAt(0) + (r.name.charCodeAt(1) || 0)) % colors.length;

      return {
        appNo: r.app_no,
        name: r.name,
        initials,
        color: colors[colorIndex],
        desig: r.designation,
        noticePd: r.notice_period || '',
        estDoj: iso(r.est_doj),
        actualDoj: iso(r.actual_doj),
        call1: fmt(r.call1_date),
        call1Remarks: r.call1_remarks || '',
        call2: fmt(r.call2_date),
        call2Remarks: r.call2_remarks || '',
        confirm: fmt(r.confirm_date),
        confirmRemarks: r.confirm_remarks || '',
        status: r.status || ''
      };
    });

    return res.json({ offers, total: offers.length });
  } catch (err) {
    return res.json({ offers: [], total: 0 });
  }
};

const logOfferCall = async (req, res) => {
  try {
    const { appNo, callNo, date, remarks } = req.body;
    if (!appNo || !callNo) return errorRes(res, 'AppNo and callNo are required', [], 400);

    const callDate = date ? new Date(date) : new Date();
    const updFields = ['updated_at = ?'];
    const params = [new Date()];

    if (callNo === 1) {
      updFields.push('call1_date = ?');
      params.push(callDate);
      if (remarks) { updFields.push('call1_remarks = ?'); params.push(remarks); }
    } else if (callNo === 2) {
      updFields.push('call2_date = ?');
      params.push(callDate);
      if (remarks) { updFields.push('call2_remarks = ?'); params.push(remarks); }
    } else if (callNo === 3) {
      updFields.push('confirm_date = ?');
      params.push(callDate);
      if (remarks) { updFields.push('confirm_remarks = ?'); params.push(remarks); }
    }

    params.push(appNo);
    await db.query(`UPDATE selection_offers SET ${updFields.join(', ')} WHERE app_no = ?`, params);

    await logAction(req.user ? req.user.username : 'HR', 'LOG_OFFER_CALL', 'OFFER', { appNo, callNo });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to log offer call', [err.message], 500);
  }
};

const updateOfferDetails = async (req, res) => {
  try {
    const { appNo, noticePd, estDoj, salaryOffered, department, otherSection, finalDesignation, branch, reportingManager } = req.body;
    if (!noticePd && !estDoj && !salaryOffered && !department && !finalDesignation && !branch) return errorRes(res, 'Enter at least one field', [], 400);

    const updFields = ['updated_at = ?'];
    const params = [new Date()];

    if (noticePd) { updFields.push('notice_period = ?'); params.push(noticePd); }
    if (estDoj) { updFields.push('est_doj = ?'); params.push(new Date(estDoj)); }
    if (finalDesignation) { updFields.push('designation = ?'); params.push(finalDesignation); }
    if (department) { updFields.push('department = ?'); params.push(department + (otherSection ? ` - ${otherSection}` : '')); }
    if (branch) { updFields.push('branch = ?'); params.push(branch); }
    if (reportingManager) { updFields.push('reporting_manager = ?'); params.push(reportingManager); }

    params.push(appNo);
    await db.query(`UPDATE selection_offers SET ${updFields.join(', ')} WHERE app_no = ?`, params);

    // Sync with candidates table
    const candUpd = ['updated_at = ?'];
    const candParams = [new Date()];
    if (noticePd) { candUpd.push('notice_period = ?'); candParams.push(noticePd); }
    if (estDoj) { candUpd.push('offered_doj = ?'); candParams.push(new Date(estDoj)); }
    if (salaryOffered) { candUpd.push('salary = ?'); candParams.push(salaryOffered); }
    if (finalDesignation) { candUpd.push('designation = ?'); candParams.push(finalDesignation); }
    if (department) { candUpd.push('department = ?'); candParams.push(department + (otherSection ? ` - ${otherSection}` : '')); }
    if (branch) { candUpd.push('branch = ?'); candParams.push(branch); }
    if (reportingManager) { candUpd.push('reporting_manager = ?'); candParams.push(reportingManager); }
    candParams.push(appNo);
    await db.query(`UPDATE candidates SET ${candUpd.join(', ')} WHERE app_no = ?`, candParams);

    await logAction(req.user ? req.user.username : 'HR', 'UPDATE_OFFER_DETAILS', 'OFFER', { appNo, noticePd, estDoj, salaryOffered });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to update offer details', [err.message], 500);
  }
};

const acceptOffer = async (req, res) => {
  try {
    const { appNo, remarks } = req.body;
    if (!remarks) return errorRes(res, 'Remarks are mandatory', [], 400);

    const now = new Date();
    await db.query(`UPDATE selection_offers SET status = 'Accepted', updated_at = ? WHERE app_no = ?`, [now, appNo]);
    await db.query(`UPDATE candidates SET status = 'Offer Accepted', updated_at = ? WHERE app_no = ?`, [now, appNo]);

    await logAction(req.user ? req.user.username : 'HR', 'ACCEPT_OFFER', 'OFFER', { appNo, remarks });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to accept offer', [err.message], 500);
  }
};

const rejectOffer = async (req, res) => {
  try {
    const { appNo, remarks } = req.body;
    if (!remarks) return errorRes(res, 'Remarks are mandatory', [], 400);

    const now = new Date();
    await db.query(`UPDATE selection_offers SET status = 'Offer Rejected', updated_at = ? WHERE app_no = ?`, [now, appNo]);
    await db.query(`UPDATE candidates SET status = 'Offer Rejected', updated_at = ? WHERE app_no = ?`, [now, appNo]);

    await logAction(req.user ? req.user.username : 'HR', 'REJECT_OFFER', 'OFFER', { appNo, remarks });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to reject offer', [err.message], 500);
  }
};

const markJoined = async (req, res) => {
  try {
    const { appNo, joiningDate } = req.body;
    if (!joiningDate) return errorRes(res, 'Joining date is required', [], 400);

    const now = new Date();
    const doj = new Date(joiningDate);

    await db.query(`UPDATE selection_offers SET status = 'Joined', actual_doj = ?, updated_at = ? WHERE app_no = ?`, [doj, now, appNo]);
    await db.query(`UPDATE candidates SET status = 'Joined', updated_at = ? WHERE app_no = ?`, [now, appNo]);

    await logAction(req.user ? req.user.username : 'HR', 'MARK_JOINED', 'OFFER', { appNo, joiningDate });

    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to mark joined', [err.message], 500);
  }
};

const updateOfferStatus = async (req, res) => {
  try {
    const { appNo, status } = req.body;
    await db.query(`UPDATE selection_offers SET status = ?, updated_at = ? WHERE app_no = ?`, [status, new Date(), appNo]);
    return res.json({ success: true });
  } catch (err) {
    return errorRes(res, 'Failed to update offer status', [err.message], 500);
  }
};

module.exports = {
  getOffers,
  logOfferCall,
  updateOfferDetails,
  acceptOffer,
  rejectOffer,
  markJoined,
  updateOfferStatus
};
