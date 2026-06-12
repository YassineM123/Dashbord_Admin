function escapePdfText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\r\n]+/g, ' ');
}

function buildContentStream(lines) {
  const commands = ['BT', '/F1 11 Tf', '50 790 Td'];
  lines.forEach((line, index) => {
    if (index > 0) {
      commands.push('0 -18 Td');
    }
    commands.push(`(${escapePdfText(line).slice(0, 110)}) Tj`);
  });
  commands.push('ET');
  return commands.join('\n');
}

export function createPdfGenerationService() {
  function createPdf(filename, lines) {
    const content = buildContentStream(lines);
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      `5 0 obj << /Length ${Buffer.byteLength(content, 'utf8')} >> stream\n${content}\nendstream endobj`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += `${object}\n`;
    }
    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return {
      filename,
      contentType: 'application/pdf',
      base64: Buffer.from(pdf, 'utf8').toString('base64'),
    };
  }

  function createInvoicePdf(invoice) {
    return createPdf(`${invoice.number}.pdf`, [
      `${invoice.business?.name || 'Store'} - Invoice ${invoice.number}`,
      `Status: ${invoice.status} | Payment: ${invoice.paymentStatus}`,
      `Date: ${String(invoice.issueDate || invoice.createdAt || '').slice(0, 10)}`,
      `Customer: ${invoice.customer?.name || invoice.customerName || ''}`,
      `Email: ${invoice.customer?.email || ''}`,
      `Address: ${invoice.customer?.address || ''} ${invoice.customer?.city || ''}`,
      '',
      'Items:',
      ...(invoice.lines || []).map(
        (line) =>
          `${line.name} | SKU ${line.sku || '-'} | Qty ${line.quantity} | Unit ${line.unitPrice} | Tax ${line.taxAmount} | Discount ${line.discountAmount} | Total ${line.total}`
      ),
      '',
      `Subtotal: ${invoice.subtotal} ${invoice.currency}`,
      `Tax: ${invoice.taxTotal} ${invoice.currency}`,
      `Discount: ${invoice.discountTotal} ${invoice.currency}`,
      `Delivery: ${invoice.deliveryFee} ${invoice.currency}`,
      `Total: ${invoice.total} ${invoice.currency}`,
    ]);
  }

  function createDeliveryNotePdf(note) {
    return createPdf(`${note.number}.pdf`, [
      `${note.business?.name || 'Store'} - Delivery note ${note.number}`,
      `Order: ${note.orderId} | Invoice: ${note.invoiceId || '-'}`,
      `Date: ${String(note.createdAt || '').slice(0, 10)}`,
      `Customer: ${note.customer?.name || note.customerName || ''}`,
      `Phone: ${note.customer?.phone || ''}`,
      `Address: ${note.customer?.address || ''} ${note.customer?.city || ''}`,
      '',
      'Delivery:',
      `Company: ${note.delivery?.company || ''}`,
      `Driver: ${note.delivery?.driverName || ''} | Phone: ${note.delivery?.driverPhone || ''}`,
      `Tracking: ${note.delivery?.trackingNumber || ''}`,
      `Status: ${note.delivery?.status || note.deliveryStatus || ''}`,
      '',
      'Products:',
      ...(note.lines || note.lineItems || []).map(
        (line) => `${line.name} | SKU ${line.sku || '-'} | Qty ${line.quantity} | ${line.size || '-'} / ${line.color || '-'} / ${line.material || '-'}`
      ),
    ]);
  }

  return { createInvoicePdf, createDeliveryNotePdf };
}
