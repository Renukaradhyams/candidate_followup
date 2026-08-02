const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if(fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      let content = fs.readFileSync(p, 'utf8');
      let modified = false;

      // Link
      if (content.includes('next/link')) {
        content = content.replace(/import Link from ['"]next\/link['"];?/g, 'import { Link } from \'react-router-dom\';');
        modified = true;
      }

      // Image
      if (content.includes('next/image')) {
        content = content.replace(/import Image from ['"]next\/image['"];?/g, '');
        content = content.replace(/<Image\s+([^>]*)\s*\/>/g, '<img $1 />');
        content = content.replace(/<Image\s/g, '<img ');
        modified = true;
      }

      // Navigation
      if (content.includes('next/navigation')) {
        content = content.replace(/import \{.*?\} from ['"]next\/navigation['"];?/g, 'import { useNavigate, useSearchParams, useLocation } from \'react-router-dom\';');
        content = content.replace(/useRouter\(\)/g, 'useNavigate()');
        content = content.replace(/usePathname\(\)/g, 'useLocation().pathname');
        modified = true;
      } else if (content.includes('usePathname')) {
        // Fallback if imported some other way
        content = content.replace(/usePathname\(\)/g, 'useLocation().pathname');
        modified = true;
      }

      // Fix Next.js <Link href=""> to React Router <Link to="">
      if (content.includes('<Link ')) {
        content = content.replace(/<Link([^>]*)href=/g, '<Link$1to=');
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(p, content);
        console.log('Updated', p);
      }
    }
  });
}

walk('hrms-system/client/src');
