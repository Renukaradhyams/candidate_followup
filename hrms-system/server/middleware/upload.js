const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');

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
    let dest = 'misc';
    if (file.fieldname === 'resume') dest = 'candidate-resumes';
    else if (file.fieldname === 'photo') dest = 'candidate-photos';
    else if (file.fieldname === 'document' || file.fieldname === 'aadhar' || file.fieldname === 'pan') dest = 'employee-documents';
    else if (file.fieldname === 'offerLetter') dest = 'offer-letters';
    else if (file.fieldname === 'relievingLetter') dest = 'relieving-letters';
    else if (file.fieldname === 'experienceCert') dest = 'experience-certificates';
    cb(null, path.join(uploadDir, dest));
  },
  filename: (req, file, cb) => {
    const rawName = (req.body && (req.body.name || req.body.candidateName)) || '';
    const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, '');
    const prefix = cleanName ? cleanName : 'Candidate';

    let docType = 'Document';
    if (file.fieldname === 'photo') docType = 'Photo';
    else if (file.fieldname === 'aadhar' || file.fieldname === 'aadhaar' || file.fieldname === 'document') docType = 'Aadhaar';
    else if (file.fieldname === 'resume') docType = 'Resume';
    else if (file.fieldname === 'offerLetter') docType = 'OfferLetter';
    else if (file.fieldname === 'relievingLetter') docType = 'RelievingLetter';
    else if (file.fieldname === 'experienceCert') docType = 'ExperienceCert';

    const ext = path.extname(file.originalname);
    let destSubdir = 'misc';
    if (file.fieldname === 'resume') destSubdir = 'candidate-resumes';
    else if (file.fieldname === 'photo') destSubdir = 'candidate-photos';
    else if (file.fieldname === 'document' || file.fieldname === 'aadhar' || file.fieldname === 'pan') destSubdir = 'employee-documents';

    const baseFileName = `${prefix}_${docType}`;
    let finalFileName = `${baseFileName}${ext}`;
    const targetDir = path.join(uploadDir, destSubdir);

    try {
      if (fs.existsSync(path.join(targetDir, finalFileName))) {
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
  const allowedExts = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file format: ${ext}. Allowed formats: PDF, DOC, DOCX, JPG, JPEG, PNG.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max document limit
});

module.exports = upload;
