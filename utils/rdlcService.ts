import axios from 'axios';

interface ReportParams {
    queryType: string;
    docNo: string;
    mainType: string;
    subType: string;
    type: string;
    prefix: string;
    partyCode: string;
    userId: string;
    companyId: string;
}

export async function generatePDF(params: ReportParams): Promise<Buffer> {
    try {
        // Make a direct request to your RDLC service
        const response = await axios({
            method: 'POST',
            url: 'https://quickbillbook.com/RDLC/RdlcReport.aspx',
            params: {
                QueryType: params.queryType,
                DocNo: params.docNo,
                MainType: params.mainType,
                SubType: params.subType,
                Type: params.type,
                Prefix: params.prefix,
                PartyCode: params.partyCode,
                UserID: params.userId,
                CompanyID: params.companyId,
                Format: 'PDF'  // Specify PDF output
            },
            responseType: 'arraybuffer'
        });

        return Buffer.from(response.data);
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw new Error('Failed to generate PDF from RDLC service');
    }
}

