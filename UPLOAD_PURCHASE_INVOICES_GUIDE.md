# Upload Purchase Invoice PDFs to Supabase Storage

## Current Issue

The Purchase Invoices have document URLs pointing to Supabase Storage:
```
https://dkrtsqienlhpouohmfki.supabase.co/storage/v1/object/public/documents/purchase-invoices/1st_Air_Shipment_3_ITEM_E0000274_2526_COMMERCIAL_INVOICE_COPY.pdf
```

But the files are only stored locally in:
```
/Finance/Purchase/
```

This causes the PDF preview to fail with "refused to connect" error.

## Solution

Upload the PDF files from `/Finance/Purchase/` to Supabase Storage bucket `documents/purchase-invoices/`.

## Steps to Upload

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Storage** in the left menu
4. Click on the **documents** bucket
5. Create folder **purchase-invoices** if it doesn't exist
6. Click **Upload Files**
7. Select all PDFs from your local `/Finance/Purchase/` folder:
   - `1st_Air_Shipment_3_ITEM_E0000274_2526_COMMERCIAL_INVOICE_COPY.pdf`
   - `1st_FCL_invoice.pdf`
   - `1st_FCL_invoice_ammonium.pdf`
   - `1st_FCL_invoice_strach.pdf`
   - `2nd_Airshipment_COMMERCIAL_INVOICE_COPY.pdf`
   - `2nd_FCL_INVOICE_10_ITEM.pdf`
8. Upload them to the `documents/purchase-invoices/` path

### Option 2: Via Supabase CLI

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref dkrtsqienlhpouohmfki

# Upload files
cd /path/to/project/Finance/Purchase
for file in *.pdf; do
  supabase storage upload "documents/purchase-invoices/$file" "./$file"
done
```

### Option 3: Via JavaScript in Browser Console

You can use this script in your browser console when logged into your app:

```javascript
// This uploads files from the Finance/Purchase folder
// Run this in browser console while logged into the app

async function uploadPurchaseInvoices() {
  const files = [
    '1st_Air_Shipment_3_ITEM_E0000274_2526_COMMERCIAL_INVOICE_COPY.pdf',
    '1st_FCL_invoice.pdf',
    '1st_FCL_invoice_ammonium.pdf',
    '1st_FCL_invoice_strach.pdf',
    '2nd_Airshipment_COMMERCIAL_INVOICE_COPY.pdf',
    '2nd_FCL_INVOICE_10_ITEM.pdf'
  ];

  for (const filename of files) {
    try {
      // You'll need to fetch the local file and upload it
      const response = await fetch(`/Finance/Purchase/${filename}`);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('documents')
        .upload(`purchase-invoices/${filename}`, blob, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (error) {
        console.error(`Failed to upload ${filename}:`, error);
      } else {
        console.log(`✅ Uploaded ${filename}`);
      }
    } catch (err) {
      console.error(`Error uploading ${filename}:`, err);
    }
  }
}

// Run it
uploadPurchaseInvoices();
```

## Verify Upload

After uploading, verify the files are accessible:

1. Check in Supabase Dashboard > Storage > documents > purchase-invoices
2. Try accessing one URL directly in browser:
   ```
   https://dkrtsqienlhpouohmfki.supabase.co/storage/v1/object/public/documents/purchase-invoices/1st_Air_Shipment_3_ITEM_E0000274_2526_COMMERCIAL_INVOICE_COPY.pdf
   ```
3. It should download or display the PDF

## After Upload

Once uploaded, the Purchase Invoice viewer will:
- ✅ Display PDF preview in `<object>` tag
- ✅ Allow "Open in New Tab"
- ✅ Show proper fallback if browser can't display inline
- ✅ Handle errors gracefully with user-friendly messages

## Improved Error Handling

The PDF viewer now includes:

1. **Better Error Messages**: Clear explanation when PDF can't load
2. **Fallback Options**: "Open in New Tab" button always available
3. **Loading States**: Spinner while PDF loads
4. **Browser Compatibility**: Uses `<object>` tag with fallback for unsupported browsers
5. **User Guidance**: Helpful messages when files aren't accessible

## Storage Bucket Configuration

Ensure the `documents` bucket is:
- ✅ **Public**: So PDFs can be accessed via public URLs
- ✅ **Proper RLS**: Allow authenticated users to upload
- ✅ **File Size Limits**: Configured for large PDFs (up to 10MB+)

Check bucket policies in Supabase Dashboard > Storage > documents > Policies.

## Alternative: Use Purchase Invoice Upload Feature

Going forward, when creating Purchase Invoices:

1. Click "New Purchase Invoice"
2. Fill in invoice details
3. Use the **File Upload** field to upload PDF directly
4. This will automatically upload to Supabase Storage
5. URL will be stored in `purchase_invoices.document_urls`

This is better than manually managing files in the codebase.

## Files to Upload

```
Finance/Purchase/1st_Air_Shipment_3_ITEM_E0000274_2526_COMMERCIAL_INVOICE_COPY.pdf → documents/purchase-invoices/
Finance/Purchase/1st_FCL_invoice.pdf → documents/purchase-invoices/
Finance/Purchase/1st_FCL_invoice_ammonium.pdf → documents/purchase-invoices/
Finance/Purchase/1st_FCL_invoice_strach.pdf → documents/purchase-invoices/
Finance/Purchase/2nd_Airshipment_COMMERCIAL_INVOICE_COPY.pdf → documents/purchase-invoices/
Finance/Purchase/2nd_FCL_INVOICE_10_ITEM.pdf → documents/purchase-invoices/
```

## Summary

**Problem**: PDF URLs point to Supabase Storage but files only exist locally
**Solution**: Upload PDFs to Supabase Storage using Dashboard or CLI
**Result**: PDF preview will work correctly in the app

The improved error handling will guide users until the files are uploaded.
