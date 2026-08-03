const fs = require('fs');
let content = fs.readFileSync('client/src/pages/OfferProcess.tsx', 'utf-8');

// 1. Add searchQuery state
content = content.replace(/const \[activeFilter, setActiveFilter\] = useState\('Pending Accept'\);/, "const [activeFilter, setActiveFilter] = useState('Pending Accept');\n  const [searchQuery, setSearchQuery] = useState('');");

// 2. Add searchQuery to useEffect dependencies and logic
content = content.replace(/setFiltered\(list\);\n    }, \[offers, activeFilter\]\);/, `if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o => 
        o.name.toLowerCase().includes(q) || 
        o.appNo.toLowerCase().includes(q) || 
        o.desig.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [offers, activeFilter, searchQuery]);`);

// 3. Add Search input above table, inside the card-glass space-y-4 div
const tableSearchStr = '<div className="overflow-x-auto">';
const tableSearchReplace = `<div className="flex items-center gap-3 bg-white border border-[#e2dfd7] rounded-xl px-3 py-1.5 w-full md:max-w-xs shadow-xs focus-within:ring-2 ring-emerald-500/20">
                <Search className="w-4 h-4 text-[#888888]" />
                <input 
                  type="text"
                  placeholder="Search by name, ID or designation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs font-semibold text-[#1E2D4E] w-full placeholder:text-[#AAAAAA]"
                />
              </div>
              <div className="overflow-x-auto">`;
content = content.replace(tableSearchStr, tableSearchReplace);


// 4. Change "Notice Period" column to "Offered Salary"
content = content.replace('<th className="py-2.5 px-3">Notice Period</th>', '<th className="py-2.5 px-3">Offered Salary</th>');
content = content.replace(/<td className="py-3 px-3">\{o\.noticePd \|\| '—'\}<\/td>/, '<td className="py-3 px-3 font-mono font-bold text-[#1E2D4E]">{o.salary ? `₹ ${o.salary}` : \'—\'}</td>');

// 5. Change Status button to dropdown in table
const statusBtnSearch = /<button\s+onClick=\{\(e\) => \{ e\.stopPropagation\(\); handleChangeStatus\(o\.appNo\); \}\}\s+className="px-2\.5 py-1 rounded bg-blue-700 text-white font-bold text-\[11px\]"\s+>\s+Status\s+<\/button>/;
const statusDropdown = `<select
                                value={o.status}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => { e.stopPropagation(); handleChangeStatus(o.appNo, e.target.value); }}
                                className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold text-[11px] outline-none cursor-pointer"
                              >
                                <option value="Pending Accept">Pending Accept</option>
                                <option value="Accepted">Accepted</option>
                                <option value="Joined">Joined</option>
                                <option value="Offer Rejected">Offer Rejected</option>
                                <option value="Declined">Declined</option>
                              </select>`;
content = content.replace(statusBtnSearch, statusDropdown);

// 6. Update handleChangeStatus in component
const changeStatusFnOld = /const handleChangeStatus = async \(appNo: string\) => \{\s+if \(saving\) return;\s+const newStatus = prompt\('Enter new status.*?'\);\s+if \(!newStatus\) return;/;
const changeStatusFnNew = `const handleChangeStatus = async (appNo: string, newStatus: string) => {
    if (saving || !newStatus) return;`;
content = content.replace(changeStatusFnOld, changeStatusFnNew);

// 7. Ensure Search is imported
if(!content.includes('Search,')) {
    content = content.replace(/import \{/, 'import { Search,');
}

fs.writeFileSync('client/src/pages/OfferProcess.tsx', content);
console.log('Fixed OfferProcess.tsx');
