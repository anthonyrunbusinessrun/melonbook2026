# Airtable Schema Inventory — MelonBook™ 2026
**Base ID:** `appmnU55C5f7A50U4`
**Inspected:** 2026-05-20
**Source:** Raymon J Land Watermelon Sales & Land Truck Brokers, Branford FL

---

## Tables

### 1. Contacts (`tblqy4XXa2ap3g66T`)
**Primary Field:** Code (singleLineText)
**Purpose:** Master record for all customers, vendors, and freight carriers.

| Field Name | Field ID | Type | Notes |
|---|---|---|---|
| Code | fldBVOTnGPIGM3tIW | singleLineText | Customer code (e.g., AUBDAL, BILPRO) |
| Name | fldpNmaaCMpAAJMBf | singleLineText | Full company/person name |
| Type | fldyiUVuGWe5wCoDt | singleSelect | Contact category |
| Entity - Company Name | fldXusDKpWbKSuWr1 | singleLineText | Legal entity name |
| Cust | fldyAOwDBI4Nb2CUy | checkbox | Is this a customer |
| Vndr | fldo17hn10DC6sbon | checkbox | Is this a vendor |
| Frgt | fldUWenPYMoScvHqk | checkbox | Is this a freight carrier |
| 1stHd | fldicRwogsjXbVkHv | checkbox | Is first handler |
| Locat | fldXKdjRuHxqfESlP | checkbox | Is a location |
| Address | fldT2gZWt0M60tkoB | singleLineText | Street address |
| City | fldm3otK4lrMldXlT | singleLineText | |
| State | fldZo7VHL5j4ZF4uI | singleLineText | |
| Zip | fldh3OV11rXeIcRfV | singleLineText | |
| Phone 1 | fld5VZMxzIN8POQhI | phoneNumber | Primary phone |
| P1 Tlt | fldXYpFK4DOacXW6e | singleLineText | Phone 1 title |
| Phone 2 | fldsYlbMLYrhDKF8p | phoneNumber | |
| P2 Tlt | fldGEi0FyWEyEuH1G | singleLineText | |
| Phone 3 | fldvJRUJ04rtNQhYW | phoneNumber | |
| P3 Tlt | fld7f8ornE01lYYjm | singleLineText | |
| eMail | fldsqZAApekjv1DoY | email | |
| Quick Note | fld1YuKgOImIZl6qD | email | Repurposed text field |
| A/R Limit | fldyy8kRmzWQc71Fr | currency | Credit limit |
| A/R Terms | fld1jF94a0Le6QpiO | number | Days (e.g., 30 = Net 30) |
| A/P Limit | fldUrKvszjwxasbwH | currency | |
| A/P Terms | fldjdV66hREnAjCEv | number | |
| Notes | fldqpjwcSITDgUcCY | richText | |
| Vouchers Performed | fldbcunMrBfHPWt9d | multipleRecordLinks → Vouchers | |
| Vouchers Issued | fldHE5W6aWTOdNFGI | multipleRecordLinks → Vouchers | |
| Vouchers | fld7T1aRXeZw0dNy4 | multipleRecordLinks → Vouchers | |
| Folios | flduv27yj4hW7UOLK | multipleRecordLinks → Folios | |
| Folios 2 | fldVNYZA86rU3M8v3 | multipleRecordLinks → Folios | |
| Accounts | fldPF3o3ECUiwiVRe | multipleRecordLinks → Accounts | |
| Register 2 | fldWxpBzyNtbk2Tjs | multipleRecordLinks | |
| Via | fldDYX607dneq3FHG | multipleRecordLinks | |
| Billing | fldOoer7HbzAatQSL | multipleRecordLinks | |
| Billing Name | fldJFNGXe0NwXzIuL | multipleLookupValues | |
| Forms Name - Line 1 | fldpyAVxSklcCQhpJ | singleLineText | |
| Forms Name - Line 2 | fld5ZmfKIvF8ueOUQ | singleLineText | |
| Forms Address | fldJGZCoGkbBUdrVC | multilineText | |
| Forms Phones | fldgNcFLBtTElKtOZ | multilineText | |
| Forms Footer | fldte6hCBlFaNk0fz | singleLineText | |
| Forms Footer Phone | fldxiSLTYr6m1NakC | singleLineText | |
| Forms Footer Site | fldOWuiAFyjbQuLil | singleLineText | |
| Contact Concat | fldVAX1Uh282BRqqY | formula | |
| Modified | fldPVyjVOScHobBER | **lastModifiedTime** | ← Used for conflict detection |
| Created | fldtobeRxW2gkwgZo | createdTime | |

**Known Customer Codes:**
ATLPRO (Atlantic Produce Exchange), AUBDAL (Auburndale Fruit), BILPRO (Billingsley Produce),
BIPMKT (Bills Produce Market), BROSON (Browning & Sons), CANFRU (Canadian Fruit & Produce Co.),
BAIFAR (Bailey Farms), DEKMAR (Dekalb Market), DNOINC (DNO Inc.), FARALL (Farmers Alliance)

---

### 2. Transactions (`tblfNYrQKvtOwslbr`)
**Primary Field:** Trans # (formula)
**Purpose:** Double-entry ledger. ~30,758 records. Core of AR.

| Field Name | Field ID | Type | Notes |
|---|---|---|---|
| Trans # | fldbRhvtatOz8j83O | formula | e.g., "DR1152-12345" — prefix + acct + auto_id |
| ID | fldOWFRqN2CxWteRh | autoNumber | Sequential ID |
| Acct | fldTjYoSMEs66ottx | multipleRecordLinks → Accounts | The account debited/credited |
| Acct Name | fldfFXjN7pABiL4Z3 | multipleLookupValues | |
| Debit | fldv8oCXfbCMovMRS | currency | |
| Credit | fldnliaXc9cjj0TUf | currency | |
| Memo | fldD9Qk0JuawPy3AA | singleLineText | |
| Rate | fld99EVL4Clik7u6L | currency | |
| +Flat | fldXqQpCHPzNiTJ28 | number | |
| Calc | fldTp5zKZ4dz8qE0I | formula | |
| Dr Qty | fldHzn0AxBLoOdSsC | number | Debit quantity |
| Cr Qty | fldIs0vWiZFyO1qnW | number | Credit quantity |
| Voucher | fldQxp3p5r0jhth3d | multipleRecordLinks → Vouchers | |
| Ref 1 | fldVraAWGaFBqdJAF | multipleLookupValues | R# (route number) |
| Ref 2 | fldCWCykZq9RVp5XA | multipleLookupValues | |
| Accrue | fldqiW7ZG84ygXcsk | multipleLookupValues | Invoice date |
| Cleared | fldwOTTo012NZR3Qd | multipleLookupValues | |
| Status | fld7jX8dYyriDmgKr | multipleLookupValues | |
| Folio | fld0m6HcwBj6WuCeN | multipleLookupValues | Lot reference |
| Via | fldKoIm5brBthMpRg | multipleLookupValues | |
| Via Free Entry | fldCejYtgl5y1OZgN | multipleLookupValues | |
| Via Resource | fld9T2ihmMvO1iisq | multipleLookupValues | |
| Item | fld7H0IYJwF7DsgwD | multipleRecordLinks → Items | |
| TLC | fldC7OVJSpU69f65j | multipleRecordLinks → Batches | |
| Vch Line | fldRPt8dMGgXeukh3 | formula | |
| Voucher Desc | fld4OrudilLeKEPzX | formula | |

**Key Account Numbers (for AR):**
- **1152** = Accounts Receivable — debit = invoiced amount
- **1122** = Undeposited Funds — credit = payment received
- **1610** = Sales - Watermelons
- **1710** = Freight Cost Watermelons
- **1310** = Accounts Payable

**Trans # Formula Pattern:**
```
{DR or CR}{Acct No}-{AutoNumber ID}
Example: DR1152-10756 = Debit to AR account, transaction #10756
```

---

### 3. Vouchers (`tblUYAd8KBsZi97Pu`)
**Primary Field:** Voucher (formula)
**Purpose:** Invoice/document records. Each voucher has transaction lines.

| Field Name | Field ID | Type | Notes |
|---|---|---|---|
| Voucher | fldGANo26r2rChdC4 | formula | Computed voucher code |
| ID | fld5qBcJ8ghi4geCW | autoNumber | |
| No | fldhqhBltSfUtp2IS | formula | |
| Status | fldEvg2z10ODCPjHz | singleSelect | Invoice status |
| Reference 1 | fldxvbA76jlbox9oG | singleLineText | R# (route/load reference) |
| Reference 2 | fldETQqxn2mCKBV7L | singleLineText | PO# or secondary reference |
| CK# | flddKipvrzgiwPkUW | singleLineText | First check number |
| Seal # | fld4sU4LN9SNbjgk5 | singleLineText | |
| Tracking # | fldoJd3XvWIopAN8i | singleLineText | |
| Via Free Entry | fld5FCzccgmC2Ge0F | multilineText | Misc/PAS info |
| Resource | fld0rSk0sIcRkl3jB | singleLineText | |
| Accrue | fldfmctZXKV2t2EXU | date | Invoice date |
| Placed | fldv9qCRNH6NSkLWa | date | |
| Perform On | fld50xgr83oJwafKY | dateTime | |
| Cleared | fldGhesaqk6z0YciI | date | Payment cleared date |
| Debit | fldor3jECFs8Q0ZXV | rollup | Total debits from transactions |
| Credit | fldCRcGLl1GoBpdVz | rollup | Total credits from transactions |
| Balance | fldvAiLneHhSjOX1C | formula | Debit - Credit |
| Co | fldE2T6MaA35U76Lp | multipleRecordLinks → Contacts | Company |
| Issued | fldJtebUtD3Ox9Eef | multipleRecordLinks → Contacts | Bill-to contact |
| Perform | fldgcPCSkKbaFnzz5 | multipleRecordLinks → Contacts | Performing party |
| Via | fld5LSDyeXpJCI65O | multipleRecordLinks → Contacts | Via contact |
| Form | fldQMZwyXwnDUY1wI | multipleRecordLinks → Forms | Document template |
| Transactions | fldMKi2sworUU2QTk | multipleRecordLinks → Transactions | |
| Folio Link | fldulw9TjAeNE5Qdf | multipleRecordLinks → Folios | |
| Folio | fld1KEsFO6TpF3iM4 | multipleLookupValues | Lot/load reference |
| Sum | fld3LFF1D2pO4LlXm | multipleRecordLinks | |
| Form Title | fld9NMG9M9YokGp0s | multipleLookupValues | |
| SORT | fldBWdHQl5sPOXUlF | multipleLookupValues | |

---

### 4. Folios (`tblxvWCSHdMKiOa56`)
**Primary Field:** Folio (formula)
**Purpose:** Load/shipment records. Each folio = one watermelon load.

| Field Name | Field ID | Type | Notes |
|---|---|---|---|
| Folio | fldbIQxYxvd6CHFBR | formula | Computed: Type-No |
| Type | fldX7ftrIxDQ5cFtl | singleSelect | Load type |
| No | fldUuD9h55ShQ49VI | singleLineText | Folio number/lot |
| Stage | fldyuXh5TY7Xg5YMp | singleSelect | Active/Complete/etc |
| Load Date | fldIMfsuBWpJqk3DP | date | |
| Operations Notes | fldhEn0SX7ZbbzoKT | multilineText | |
| Quick Look | fld7c5ITsUiDzANlV | singleLineText | Summary label |
| Rating | fldyBJ1H4N6aKC48i | rating | |
| SORT | flduhhcsas3oPc5th | number | |
| Base | fldnTEcZ9pJBE9abp | multipleRecordLinks → Contacts | |
| Vouchers | fld0Y4OiVL1NlE0kC | multipleRecordLinks → Vouchers | |
| Register | fldJ7VWxYhIq0RBkr | multipleRecordLinks | |
| Transactions | fldhN6t1mWYd6BCma | multipleLookupValues | |
| Inventory | fldRyZhcqcG1CDtCk | multipleLookupValues | |
| Perform | fldY6ITCabwQFpaqy | multipleLookupValues | |
| Ref 1 | fldymFSm0cm2gIopk | multipleLookupValues | |
| Ref 2 | fldeBy3YwblkU10cS | multipleLookupValues | |
| Dates | fldMRkWygQqBDex1y | multipleLookupValues | |
| Issued (from Vouchers) | fldgwySWQK9EjCv2y | multipleLookupValues | |
| Agent | fldpvQqCuOhuUgHeD | multipleRecordLinks | Freight agent |

---

### 5. Accounts (`tblmt7JoM80l0vO5I`)
**Primary Field:** Acct Code (formula)
**Purpose:** Chart of accounts.

| Field Name | Field ID | Type | Notes |
|---|---|---|---|
| Acct Code | fld0M2Fey3AGgSuEc | formula | e.g., "RJL-1152" |
| No | fldbRQ1rUH8Xq3WSn | number | Account number |
| Title | fldImwbUVA875BZUg | singleLineText | Account name |
| Acct Type | fldwv0WMJ5LmXZlXv | singleSelect | Asset/Liability/Revenue/Expense |
| Def | fld07t37aqJykqE6d | singleSelect | Default type |
| Frequent | fldW739meMtm8cdvm | checkbox | |
| Stmt | fldxoURW85SeYw1R5 | singleLineText | Statement label |
| Debits | fldoyzlNTqE8GkbT2 | rollup | |
| Credits | fldPHwa2S0oXNx0Mw | rollup | |
| Balance | fld4rSCYJGgWljNjv | formula | Debits - Credits |
| Co | fldwajXKcL7fmwNpu | multipleRecordLinks → Contacts | Company |
| Transactions | fldHHi0dBZrMB3FTX | multipleRecordLinks → Transactions | |

---

### 6. Items (`tblOarNFTnDsSaO75`)
**Primary Field:** SKU (singleLineText)
**Purpose:** Product catalog (watermelon SKUs).

| Field Name | Field ID | Type |
|---|---|---|
| SKU | fldb9kSr2iOQaYIR5 | singleLineText |
| Type | fldu5gmJ1fN4DtkUo | singleLineText |
| Short Title | fld6xk6FQmtEwrwUW | singleLineText |
| Long Title | fldsNvzYnKKrJh1io | singleLineText |
| Title | fldhvZcSE4Iaz11Dg | singleLineText |
| UoM | fldVDxcntvsvZ0VrA | singleLineText |
| Lbs | fldMQEIMFMQLunrfS | number |
| Dims | fldDDB7GjaamJRHg3 | singleLineText |
| Transactions | fld62D8tXo06SDJbB | multipleRecordLinks |

---

### 7. Batches (`tblIdxdCej9QvdirO`)
**Primary Field:** TLC (formula)
**Purpose:** TLC barcode batches for USDA lot tracking.

| Field Name | Field ID | Type |
|---|---|---|
| TLC | fldPDASYSaQRFSs8Q | formula |
| Date | fldU4rN4TxOBpRnQK | date |
| Batch | fldPPRpVhfcQ8Lk | singleLineText |
| PLU | fldd64KBCj2hDI8CU | singleLineText |
| GTIN | fldBJTkTD7GmhHygp | singleLineText |
| UPC | fldQnEopCTPzDpDFZ | singleLineText |
| Desc Lg | fldPSp7mMVMd6KWUX | singleLineText |
| Desc Sm | fldCy5AlLMGsZupNv | singleLineText |
| Origin | fldkavtHH6zQsLU9g | singleLineText |
| Packer | flduEx0WyVW6pVryI | multilineText |

---

### 8. Forms (`tbl4vy605bt4KPDgA`)
**Primary Field:** Code (singleLineText)
**Purpose:** Invoice/document template definitions.

| Field Name | Field ID | Type |
|---|---|---|
| Code | fldfesCcBb2HHQXWr | singleLineText |
| Type | fldta54gYSZPAA9cc | singleLineText |
| Form Title | fldupGIyYRq3phV7e | singleLineText |
| Long Title | fld4wKjegsasC4Swq | singleLineText |
| Style | fldoyepbirBGhEgIp | singleSelect |
| Group | fldVQdOuvrieGPvNf | singleSelect |

---

## AR Spreadsheet → Postgres Column Mapping

| AR Column | Source in Airtable | Postgres Field |
|---|---|---|
| Cust ID | Contacts.Code via Voucher.Issued | contacts.code |
| Div. | Voucher.Via_Free_Entry or prefix | vouchers.division |
| Lot # | Folio.No (numeric lot number) | vouchers.lot_no |
| R # | Voucher.Reference1 | vouchers.r_no |
| Misc/PAS | Voucher.Via_Free_Entry | vouchers.via_free_entry |
| PO # | Voucher.Reference2 | vouchers.reference2 |
| INV Date | Voucher.Accrue | vouchers.accrue_date |
| Dep # | Payment Voucher Reference (REG-XX, PNC-XX) | vouchers.dep_no |
| Dep Date | Payment Voucher Cleared | vouchers.dep_date |
| 1st Check # | Voucher.CK# | vouchers.ck_no |
| 2nd Check # | Second CK# | vouchers.ck_no2 |
| Invoiced | Transactions.Debit WHERE Acct=1152 | SUM(transactions.debit) WHERE account_no=1152 |
| Invoice Credits | Transactions.Credit WHERE Acct=1152 | SUM(transactions.credit) WHERE account_no=1152 |
| Total Invoiced | = Invoiced + Invoice Credits | COMPUTED |
| Unloading Fee | Specific account transactions | COMPUTED |
| Adjustments | Adjustment account transactions | COMPUTED |
| Amount Paid | Transactions.Credit WHERE Acct=1122 | SUM(transactions.credit) WHERE account_no=1122 |
| Balance Due | = Total Invoiced + Unloading + Adj - Paid | COMPUTED |
| Memo | Voucher/Transaction.Memo | vouchers.memo |

## AR Formulas

```
Total Invoiced = Invoiced + Invoice Credits
Balance Due = Total Invoiced + Unloading Fee + Adjustments - Amount Paid
```

## Key Account Views in Airtable

| View Name | Account | Purpose |
|---|---|---|
| ACCTG – BAL AR INV 1152 | 1152 | Accounts Receivable balance validation |
| ACCTG – BAL AR INV 1122 | 1122 | Undeposited Funds balance validation |

## Deposit Number Patterns

Payment vouchers use these prefix patterns for `dep_no`:
- `PNC-XX` — PNC Bank deposits (e.g., PNC-43, PNC-51)
- `REG-XX` — Regular deposits (e.g., REG-11, REG-18)
- Numbers are sequential and used to group payments in a single deposit run

## Conflict Detection Strategy

1. Contacts use `Modified` (lastModifiedTime) field for AT-side timestamp
2. Transactions/Vouchers use `Accrue` and internal Airtable created timestamps
3. Postgres tracks `postgres_updated_at` (auto-updated trigger) and `airtable_updated_at`
4. Latest-edit-wins: compare timestamps, apply winner, save both snapshots to `conflict_audit`
5. Origin marker (`sync_origin='airtable'`) prevents write-back loops

## 2025 AR Data Sample (from Excel)

Confirmed 2025 customers with actual transaction data:
- **AUBDAL** (Auburndale Fruit): 30+ loads, $194,998 total invoiced, $194,900 paid ($98 adjustment), $0 balance
- **BILPRO** (Billingsley Produce): 50+ loads ranging $7K–$16K per load
- Customer codes use 6-character convention: first 3 letters of city + first 3 of company name

## Hidden Customers (No Sales Activity)

These customers exist in Contacts but have no AR activity in 2025/2026:
ATLPRO, BAIFAR, BSMEL, BIPMKT, DEKMAR, DNOINC, FARALL, FRESH, FREYCO, JACVIL,
JOHAL, KIDCHO, LEGPRO, MEICOM, NATSWE, PUCJAC, RACWES, REDLAB, SCHPRO, SMIINC, SUNSTA, VEGKIN, WIGWHO
