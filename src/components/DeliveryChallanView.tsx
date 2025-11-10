import { useRef } from 'react';
import { X, Printer, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ChallanItem {
  id: string;
  product_id: string;
  batch_id: string;
  quantity: number;
  pack_size: number | null;
  pack_type: string | null;
  number_of_packs: number | null;
  products?: {
    product_name: string;
    product_code: string;
    unit: string;
  };
  batches?: {
    batch_number: string;
    expiry_date: string | null;
    packaging_details: string | null;
  };
}

interface DeliveryChallanViewProps {
  challan: {
    id: string;
    challan_number: string;
    customer_id: string;
    challan_date: string;
    delivery_address: string;
    vehicle_number: string | null;
    driver_name: string | null;
    status: string;
    notes: string | null;
    customers?: {
      company_name: string;
      address: string;
      city: string;
      phone: string;
      pbf_license: string;
    };
  };
  items: ChallanItem[];
  onClose: () => void;
  companySettings?: {
    company_name: string;
    address: string;
    city: string;
    phone: string;
    email: string;
    website: string;
    npwp: string;
    logo_url: string | null;
  } | null;
}

export function DeliveryChallanView({ challan, items, onClose }: DeliveryChallanViewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: printRef.current.scrollWidth,
        windowHeight: printRef.current.scrollHeight
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(scaledHeight, pdfHeight));
      pdf.save(`Delivery-Challan-${challan.challan_number}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${year}`;
  };

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const firstItemUnit = items[0]?.products?.unit || 'kg';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-75 print:static print:bg-white print:overflow-visible">
      <div className="flex min-h-screen items-start justify-center p-4 pt-10 print:p-0 print:min-h-0 print:block">
        <div className="relative w-full max-w-5xl bg-white shadow-xl print:shadow-none print:max-w-full">
          {/* Action Buttons - Hidden on print */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4 print:hidden">
            <h2 className="text-xl font-bold text-gray-900">
              Surat Jalan {challan.challan_number}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                <Printer className="h-4 w-4" />
                Cetak
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
              >
                <Download className="h-4 w-4" />
                PDF
              </button>
              <button
                onClick={onClose}
                className="rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Challan Content */}
          <div id="challan-print-content" ref={printRef} className="p-8">
            {/* Header Section - Company Details */}
            <div className="mb-3 border-2 border-black p-3 print:mb-2 print:p-2">
              <div className="mb-2 flex items-start justify-between">
                {/* Company Logo and Info */}
                <div className="flex items-start gap-3">
                  <div className="h-16 w-16 flex items-center justify-center print:h-12 print:w-12">
                    <img src="/src/assets/Untitled-1.svg" alt="Company Logo" className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <h1 className="text-base font-bold print:text-sm">PT. SHUBHAM ANZEN PHARMA JAYA</h1>
                    <p className="text-xs print:text-[10px]">Komplek Ruko Metro Sunter Blok A1 NO.15, Jl. Metro Indah Raya,</p>
                    <p className="text-xs print:text-[10px]">Kelurahan Papanggo, Kec. Tanjung Priok, Jakarta Utara - 14340</p>
                    <p className="text-xs print:text-[10px]">Telp: (+62 21) 65832426</p>
                  </div>
                </div>

                {/* SURAT JALAN Title */}
                <div className="text-right">
                  <h2 className="text-3xl font-bold print:text-2xl">SURAT JALAN</h2>
                </div>
              </div>

              {/* Company Licenses */}
              <div className="text-xs space-y-0.5 print:text-[10px] print:space-y-0">
                <div>
                  <span className="font-semibold">No izin PBF</span>
                  <span className="ml-16">: 27092400534390007</span>
                </div>
                <div>
                  <span className="font-semibold">No Sertifikasi CDOB</span>
                  <span className="ml-4">: 270924005343900070001</span>
                </div>
              </div>
            </div>

            {/* Customer and Challan Details */}
            <div className="mb-3 border-2 border-black p-3 print:mb-2 print:p-2">
              <div className="flex justify-between">
                {/* Left - Customer Details */}
                <div className="space-y-1 text-xs print:text-[10px] print:space-y-0 flex-1">
                  <div className="mb-1">
                    <span className="font-bold">Company Name:</span>
                  </div>
                  <div className="ml-4 mb-2">
                    <p className="font-semibold">{challan.customers?.company_name || ''}</p>
                  </div>
                  <div className="mb-1">
                    <span className="font-bold">Address:</span>
                  </div>
                  <div className="ml-4 mb-2">
                    <p>{challan.delivery_address || ''}</p>
                    <p>{challan.customers?.city || ''}</p>
                  </div>
                  <div className="mb-1">
                    <span className="font-bold">Phone:</span>
                    <span className="ml-2">{challan.customers?.phone || '-'}</span>
                  </div>
                  <div>
                    <span className="font-bold">No.Izin PBF:</span>
                    <span className="ml-2">{challan.customers?.pbf_license || '-'}</span>
                  </div>
                </div>

                {/* Right - Challan Details */}
                <div className="space-y-1 text-xs print:text-[10px] print:space-y-0 text-right w-64">
                  <div className="mb-1">
                    <span className="font-bold">Challan No: </span>
                    <span>{challan.challan_number}</span>
                  </div>
                  <div className="mb-1">
                    <span className="font-bold">Challan Date: </span>
                    <span>{formatDate(challan.challan_date)}</span>
                  </div>
                  {challan.vehicle_number && (
                    <div>
                      <span className="font-bold">Vehicle No: </span>
                      <span>{challan.vehicle_number}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-3 border-2 border-black print:mb-2">
              <table className="w-full border-collapse text-xs print:text-[10px]">
                <thead>
                  <tr className="border-b-2 border-black">
                    <th className="border-r border-black p-2 text-center font-bold print:p-1" style={{ width: '5%' }}>No</th>
                    <th className="border-r border-black p-2 text-left font-bold print:p-1" style={{ width: '30%' }}>Nama Produk<br/>Product Name</th>
                    <th className="border-r border-black p-2 text-center font-bold print:p-1" style={{ width: '12%' }}>No Batch<br/>Batch No</th>
                    <th className="border-r border-black p-2 text-center font-bold print:p-1" style={{ width: '12%' }}>Exp. Date</th>
                    <th className="border-r border-black p-2 text-center font-bold print:p-1" style={{ width: '18%' }}>Kemasan<br/>Packaging</th>
                    <th className="border-r border-black p-2 text-center font-bold print:p-1" style={{ width: '8%' }}>Jumlah<br/>Packs</th>
                    <th className="p-2 text-center font-bold print:p-1" style={{ width: '15%' }}>Kuantitas<br/>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className="border-b border-black">
                      <td className="border-r border-black p-2 text-center print:p-1">{index + 1}</td>
                      <td className="border-r border-black p-2 print:p-1">{item.products?.product_name}</td>
                      <td className="border-r border-black p-2 text-center print:p-1">{item.batches?.batch_number}</td>
                      <td className="border-r border-black p-2 text-center print:p-1">
                        {item.batches?.expiry_date ? formatDate(item.batches.expiry_date) : '-'}
                      </td>
                      <td className="border-r border-black p-2 text-center print:p-1">
                        {item.pack_type && item.pack_size ? `${item.pack_size} ${item.pack_type}` : '-'}
                      </td>
                      <td className="border-r border-black p-2 text-center print:p-1">
                        {item.number_of_packs || '-'}
                      </td>
                      <td className="p-2 text-center print:p-1">{item.quantity.toLocaleString()} {item.products?.unit || firstItemUnit}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-black bg-gray-50 font-bold">
                    <td colSpan={6} className="border-r border-black p-2 text-right print:p-1">
                      Total Kuantitas / Total Quantity:
                    </td>
                    <td className="p-2 text-center print:p-1">
                      {totalQuantity.toLocaleString()} {firstItemUnit}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Notes Section */}
            <div className="mb-3 p-2 print:mb-2 print:p-1.5">
              <p className="text-xs font-semibold print:text-[10px]">Catatan / Notes:</p>
              {challan.notes ? (
                <p className="text-xs print:text-[10px] mt-1">{challan.notes}</p>
              ) : (
                <p className="text-xs print:text-[10px] mt-1">Produk dikirim dalam kondisi sesuai persyaratan penyimpanan / Goods are delivered under controlled storage conditions.</p>
              )}
            </div>

            {/* Signature Section */}
            <div className="grid grid-cols-3 gap-4 print:gap-2">
              <div className="border-2 border-black p-2 text-center print:p-1.5">
                <div className="mb-16 text-xs font-semibold print:mb-12 print:text-[10px]">
                  Disiapkan Oleh<br/>Prepared By
                </div>
                <div className="border-t-2 border-black pt-2 print:pt-1">
                  <div className="h-6 print:h-4"></div>
                  <p className="text-xs print:text-[10px]">Tanda Tangan & Tanggal</p>
                  <p className="text-xs print:text-[10px]">Signature & Date</p>
                </div>
              </div>
              <div className="border-2 border-black p-2 text-center print:p-1.5">
                <div className="mb-16 text-xs font-semibold print:mb-12 print:text-[10px]">
                  Dikirim Oleh<br/>Delivered By
                </div>
                <div className="border-t-2 border-black pt-2 print:pt-1">
                  <div className="h-6 print:h-4"></div>
                  <p className="text-xs print:text-[10px]">Tanda Tangan & Tanggal</p>
                  <p className="text-xs print:text-[10px]">Signature & Date</p>
                </div>
              </div>
              <div className="border-2 border-black p-2 text-center print:p-1.5">
                <div className="mb-16 text-xs font-semibold print:mb-12 print:text-[10px]">
                  Diterima Oleh<br/>Received By
                </div>
                <div className="border-t-2 border-black pt-2 print:pt-1">
                  <div className="h-6 print:h-4"></div>
                  <p className="text-xs print:text-[10px]">Tanda Tangan & Tanggal</p>
                  <p className="text-xs print:text-[10px]">Signature & Date</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          .sticky {
            display: none !important;
          }

          body * {
            visibility: hidden;
          }

          #challan-print-content,
          #challan-print-content * {
            visibility: visible;
          }

          #challan-print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
