const multer = require('multer');
const path = require('path');
const fs = require('fs');

const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../../.env') });

let uploadDir = process.env.UPLOAD_DIR;

if (!uploadDir) {
  uploadDir = path.join(__dirname, '../../../uploads'); // 1 level above BSC-Candidate-Followup-main
  try {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  } catch (e) {
    // Fallback to local uploads if parent is not writable
    uploadDir = path.join(__dirname, '../../uploads'); // hrms-system/uploads
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  }
} else {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}
const subdirs = [
  'candidate-resumes',
  'candidate-photos',
  'employee-documents',
  'offer-letters',
  'relieving-letters',
  'experience-certificates',
  'misc'
];

subdirs.forEach((dir) => {
  const fullPath = path.join(uploadDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let appNoRaw = req.headers['x-app-no'] || req.body.appNo || req.query.appNo;
    let appNo = (appNoRaw && appNoRaw !== 'undefined' && appNoRaw !== 'null') ? appNoRaw : null;
    
    if (appNo) {
      // New structure: /uploads/applicants/BSC-2026-0001
      const applicantDir = path.join(uploadDir, 'applicants', appNo);
      if (!fs.existsSync(applicantDir)) {
        fs.mkdirSync(applicantDir, { recursive: true });
      }
      cb(null, applicantDir);
    } else {
      // Backward compatibility / Misc uploads if no appNo
      let dest = 'misc';
      if (file.fieldname === 'resume') dest = 'candidate-resumes';
      else if (file.fieldname === 'photo') dest = 'candidate-photos';
      else if (file.fieldname === 'document' || file.fieldname === 'aadhar' || file.fieldname === 'pan') dest = 'employee-documents';
      else if (file.fieldname === 'offerLetter') dest = 'offer-letters';
      else if (file.fieldname === 'relievingLetter') dest = 'relieving-letters';
      else if (file.fieldname === 'experienceCert') dest = 'experience-certificates';
      cb(null, path.join(uploadDir, dest));
    }
  },
  filename: (req, file, cb) => {
    let rawName = (req.body && (req.body.name || req.body.candidateName || req.body.candName)) || '';
    if (!rawName && req.headers && req.headers['x-candidate-name']) {
      try { rawName = decodeURIComponent(req.headers['x-candidate-name']); } catch(e) {}
    }
    if (!rawName && req.query && req.query.name) {
      rawName = req.query.name;
    }
    const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, '');
    const prefixName = cleanName ? cleanName : 'Candidate';

    let appNoRaw = req.headers['x-app-no'] || req.body.appNo || req.query.appNo;
    let appNo = (appNoRaw && appNoRaw !== 'undefined' && appNoRaw !== 'null') ? appNoRaw : null;
    const prefix = appNo ? `${appNo}_${prefixName}` : prefixName;

    let docType = 'Document';
    if (file.fieldname === 'photo') docType = 'Photo';
    else if (file.fieldname === 'aadhar' || file.fieldname === 'aadhaar' || file.fieldname === 'document') docType = 'Aadhaar';
    else if (file.fieldname === 'resume') docType = 'Resume';
    else if (file.fieldname === 'offerLetter') docType = 'OfferLetter';
    else if (file.fieldname === 'relievingLetter') docType = 'RelievingLetter';
    else if (file.fieldname === 'experienceCert') docType = 'ExperienceCert';

    const originalName = file.originalname || 'unknown.file';
    const ext = path.extname(originalName) || '.jpg';
    const baseFileName = `${prefix}_${docType}`;
    let finalFileName = `${baseFileName}${ext}`;

    // Prevent duplicates by checking if file exists in the destination
    const destDir = appNo ? path.join(uploadDir, 'applicants', appNo) : uploadDir; // Approximation for existence check
    try {
      if (fs.existsSync(path.join(destDir, finalFileName))) {
        const suffix = Date.now().toString().slice(-6);
        finalFileName = `${baseFileName}_${suffix}${ext}`;
      }
    } catch (e) {
      finalFileName = `${baseFileName}_${Date.now()}${ext}`;
    }

    cb(null, finalFileName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/pjpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/svg+xml'
  ];
  const allowedExts = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.svg', '', '.'];
  const ext = file.originalname ? path.extname(file.originalname).toLowerCase() : '';
  const mime = file.mimetype ? file.mimetype.toLowerCase() : '';

  if (allowedExts.includes(ext) || allowedTypes.includes(mime) || mime.startsWith('image/') || !ext || ext === '.') {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file format: ${ext}. Allowed formats: PDF, DOC, DOCX, JPG, JPEG, PNG, WEBP.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1000 * 1024 } // 1000KB (1MB) max document limit strictly enforced
});

module.exports = upload;
