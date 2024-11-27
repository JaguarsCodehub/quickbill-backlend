import { config } from "dotenv";
import { Request, Response } from "express";

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sql = require('mssql');
const encrypt = require('./utils/encrypt');

const app = express();
app.use(bodyParser.json());
app.use(express.json());
app.use(cors());

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
    },
};

async function getDbConnection() {
    try {
        const pool = await sql.connect(dbConfig);
        console.log('Connected to the database');
        return pool;
    } catch (error) {
        console.error('Error connecting to the database:', error);
        throw error;
    }
}

app.listen(3000, () => {
    getDbConnection();
    console.log('Server is running on port 3000');
});


app.get('/', (req: Request, res: Response) => {
    res.send('Hello World');
});

app.get('/api/data', async (req: Request, res: Response) => {
    let connection;
    try {
        connection = await getDbConnection();
        const request = connection.request();

        const query = `
SELECT [CompanyID]
      ,[CompanyName]
      ,[Address1]
      ,[Address2]
      ,[Address3]
      ,[City]
      ,[Zip]
      ,[State]
      ,[Country]
      ,[Email]
      ,[Mobile]
      ,[Telephone]
      ,[Currency]
      ,[TaxType]
      ,[UserID]
      ,[UserName]
      ,[Password]
      ,[StoreCode]
      ,[Tag1]
      ,[Tag2]
      ,[Tag3]
      ,[Tag4]
      ,[Tag5]
      ,[GSTCategory]
      ,[GSTCode]
      ,[Tag6]
      ,[Tag7]
      ,[TermCodition]
      ,[Garment]
      ,[Matrix]
      ,[eInovise]
      ,[PurchesMatrix]
      ,[EwayBill]
      ,[Qrimg]
      ,[TAN]
      ,[UdyamNo]
      ,[msme]
      ,[adhearno]
      ,[fssino]
      ,[Drug1]
      ,[Drug2]
      ,[cin]
  FROM [QuickbillBook].[dbo].[CompanyMaster]`

        const result = await request.query(query);
        res.json(result.recordset);
        console.log("Data fetched successfully 🟢");
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).send('Server error');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.post('/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const encryptedPassword = encrypt(password);

        const result = await pool.request()
            .input('username', sql.VarChar, username)
            .input('password', sql.VarChar, encryptedPassword)
            .query(`
                SELECT s.*, u.Tag5, u.Tag2, u.StoreCount, 
                       ISNULL(c.CompanyName, '') as CompanyName,  -- Include CompanyName
                       ISNULL(c.TaxType, '') as TaxType,
                       ISNULL(c.Garment, '') as Garment,
                       ISNULL(c.Matrix, '') as Matrix,
                       ISNULL(c.eInovise, '') as eInovise,
                       ISNULL(c.PurchesMatrix, '') as PurchesMatrix,
                       ISNULL(c.EwayBill, '') as EwayBill,
                       ISNULL(c.UserName, '') as CUsername,
                       ISNULL(c.Currency, '') as Currency,
                       ISNULL(c.State, '') as [State],
                       ISNULL(st.Size, '') as Size,
                       ISNULL(st.[Format], '') as [Format],
                       ISNULL(c.Tag3, '') as gst,
                       ISNULL(Billwisediscount, '0') as Billwisediscount,
                       ISNULL(sing, '') as sing,
                       ISNULL(st.[Order], '') as [Order],
                       ISNULL(st.Search, '') as Search,
                       ISNULL(st.MFG, '0') as MFG,
                       ISNULL(st.SubCounstrter, '0') as SubCounstrter,
                       ISNULL(Bom, '') as Bom,
                       ISNULL(store, '') as store,
                       ISNULL(Pwds, '0') as Pwds,
                       ISNULL(Pwdp, '0') as Pwdp
                FROM SubUserMaster s
                INNER JOIN CompanyMaster c ON c.CompanyID = s.CompanyID
                INNER JOIN UserMaster u ON s.UserID = u.UserID
                LEFT JOIN Setting st ON st.UserID = s.UserID
                LEFT JOIN Module m ON m.UserID = u.UserID
                WHERE s.UserName = @username
                AND s.[Password] = @password
                AND s.IsActive = 1
            `);

        if (result.recordset.length > 0) {
            res.json(result.recordset[0]); // Send the first (and should be only) matching record
        } else {
            res.status(401).json({ message: 'Invalid username or password' });
        }
    } catch (err) {
        console.error('SQL error', err);
        res.status(500).json({ message: 'Server error' });
    } finally {
        if (pool) {
            await pool.close();
        }
    }
});


app.post('/addCustomer', async (req: Request, res: Response) => {
    const {
        name,
        groupName,
        contactName,
        address1,
        address2,
        city,
        postalCode,
        state,
        country,
        companyId,
        userId,
        regType_tag3,
        D_tag5,
        created_by_userId,
        modified_by_userId,
        modified_date,
        flag_L,
        gstNo,
        groupCode
    } = req.body;

    let pool;
    try {
        pool = await sql.connect(dbConfig);

        // First, get the latest code
        const codeResult = await pool.request()
            .input('Flag', sql.Char(1), flag_L)
            .input('CompanyID', sql.Int, companyId)
            .input('UserID', sql.Int, userId)
            .query(`
                SELECT TOP 1 ISNULL(Code, '0') AS SRL FROM Customer 
                WHERE Flag = @Flag
                AND CompanyID = @CompanyID
                AND UserID = @UserID
                ORDER BY Code DESC
            `);

        let latestCode = parseInt(codeResult.recordset[0].SRL || '0');
        let newCode = (latestCode + 1).toString().padStart(9, '0');

        const result = await pool.request()
            .input('CustomerName', sql.VarChar, name)
            .input('CustomerGroup', sql.VarChar, groupName)
            .input('ContactPerson', sql.VarChar, contactName)
            .input('Address1', sql.VarChar, address1)
            .input('Address2', sql.VarChar, address2)
            .input('City', sql.VarChar, city)
            .input('Pin', sql.VarChar, postalCode)
            .input('State', sql.VarChar, state)
            .input('Country', sql.VarChar, country)
            .input('CompanyID', sql.Int, companyId)
            .input('UserID', sql.Int, userId)
            .input('Tag3', sql.VarChar, regType_tag3)
            .input('Tag5', sql.VarChar, D_tag5)
            .input('CreatedBy', sql.Int, created_by_userId)
            .input('ModifiedBy', sql.Int, modified_by_userId)
            .input('ModifiedDate', sql.DateTime, modified_date)
            .input('Code', sql.VarChar, newCode)
            .input('Flag', sql.Char(1), flag_L)
            .input('GSTTIN', sql.VarChar, gstNo)
            .input('GroupCode', sql.VarChar, groupCode)
            .query(`
                INSERT INTO [QuickbillBook].[dbo].[Customer]
                (CustomerName, CustomerGroup, ContactPerson, Address1, Address2, City, Pin, State, Country,
                CompanyID, UserID, Tag3, Tag5, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate, Code, Flag, GSTTIN, GroupCode)
                VALUES
                (@CustomerName, @CustomerGroup, @ContactPerson, @Address1, @Address2, @City, @Pin, @State, @Country,
                @CompanyID, @UserID, @Tag3, @Tag5, @CreatedBy, GETDATE(), @ModifiedBy, @ModifiedDate, @Code, @Flag, @GSTTIN, @GroupCode);
                
                SELECT SCOPE_IDENTITY() AS CustomerID;
            `);

        const newCustomerId = result.recordset[0].CustomerID;
        res.status(201).json({ message: 'Customer added successfully', customerId: newCustomerId, code: newCode });
        console.log("Customer added successfully", newCustomerId)
    } catch (error: any) {
        console.error('Error adding customer:', error);
        res.status(500).json({ message: 'Server error while adding customer' });
        console.log("Error while adding customer", error.message)
    } finally {
        if (pool) {
            await pool.close();
        }
    }
});

app.get('/customers', async (req: Request, res: Response) => {
    let connection;

    try {

        const userID = req.header('UserID');

        console.log("UserID", userID)
        connection = await getDbConnection();
        const request = connection.request();

        request.input('UserID', sql.Int, userID);

        const query = ` SELECT [CustomerID]
                            ,[CustomerName]
                            ,[CustomerGroup]
                            ,[CustomerType]
                            ,[ContactPerson]
                            ,[Address1]
                            ,[Address2]
                            ,[Address3]
                            ,[City]
                            ,[Pin]
                            ,[State]
                            ,[Country]
                            ,[Mobile1]
                            ,[Mobile2]
                            ,[Telephone1]
                            ,[Telephone2]
                            ,[Email]
                            ,[Website]
                            ,[GSTTIN]
                            ,[PANNo]
                            ,[VATNo]
                            ,[TINNo]
                            ,[LicenseNo1]
                            ,[License2]
                            ,[Opening]
                            ,[CompanyID]
                            ,[UserID]
                            ,[Tag1]
                            ,[Tag2]
                            ,[Tag3]
                            ,[Tag4]
                            ,[Tag5]
                            ,[CreatedBy]
                            ,[CreatedDate]
                            ,[ModifiedBy]
                            ,[ModifiedDate]
                            ,[Code]
                            ,[Flag]
                            ,[GroupCode]
                            ,[Aadhaar]
                            ,[Mssme]
                            ,[fssai]
                            ,[udyam]
                        FROM [QuickbillBook].[dbo].[Customer]
                        WHERE UserID = @UserID ORDER BY CustomerName ASC
                    `


        const result = await request.query(query);
        res.json(result.recordset);

    } catch (error) {
        console.error("Error while fetching customers", error)
    }
})

app.get('/items', async (req: Request, res: Response) => {
    let pool;
    try {
        // Get values from headers
        const userID = req.header('UserID');
        const companyID = req.header('CompanyID');
        const prefix = req.header('Prefix');

        // Validate headers
        if (!userID || !companyID || !prefix) {
            return res.status(400).json({ error: "Missing required headers: UserID, CompanyID, or Prefix" });
        }

        pool = await sql.connect(dbConfig);

        // Query for items
        const itemsRequest = pool.request();
        itemsRequest.input('UserID', sql.Int, parseInt(userID));
        itemsRequest.input('CompanyID', sql.Int, parseInt(companyID));

        const itemsQuery = `
            SELECT [ItemID], [ItemCode], [ItemName], [PurRate], [PurDisc], [SalRate], [SalDisc],
                   [Barcode], [OpeningStock], [Unit], [MRP], [TaxCode], [UserID], [CompanyID],
                   [CreatedBy], [CreatedDate], [ModifiedBy], [ModifiedDate], [GroupCode], [Flag],
                   [HSNCode], [TaxCategory], [GSTTaxCode], [IGSTTaxCode], [UTGSTTaxCode], [imgPath],
                   [Catagri], [grosswegiht], [netwegiht], [purity], [print], [makingcharge], [Othercharge]
            FROM [QuickbillBook].[dbo].[ItemMaster] 
            WHERE UserID = @UserID AND CompanyID = @CompanyID ORDER BY ItemName ASC`;

        const itemsResult = await itemsRequest.query(itemsQuery);

        // Query for last serial code
        const serialRequest = pool.request();
        serialRequest.input('UserID', sql.Int, parseInt(userID));
        serialRequest.input('CompanyID', sql.Int, parseInt(companyID));
        serialRequest.input('Prefix', sql.VarChar, prefix);

        const serialQuery = `
            SELECT TOP 1 ISNULL(DocNo, 0) as SRL 
            FROM Orders 
            WHERE MainType='SL' 
            AND SubType='RS' 
            AND [Type]='SOR' 
            AND Prefix=@Prefix
            AND CompanyID=@CompanyID
            AND UserID=@UserID
            ORDER BY SRL DESC`;

        const serialResult = await serialRequest.query(serialQuery);

        const lastSerial = serialResult.recordset[0]?.SRL || '0';
        const nextSerialNumber = parseInt(lastSerial) + 1;
        const nextSerial = nextSerialNumber.toString().padStart(6, '0');

        res.json({
            items: itemsResult.recordset,
            lastSerial: lastSerial,
            nextSerial: nextSerial
        });

    } catch (error) {
        console.error("Error while fetching items and serial", error);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        if (pool) {
            await pool.close();
        }
    }
});

app.post('/api/create-order', async (req: Request, res: Response) => {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const {
            docNo, docDate, orderNo, orderDate, pageNo, partyCode, billAmt, totalQty, netAmt, taxAmt, discAmt,
            mainType, subType, type, prefix, narration, userId, companyId, createdBy, modifiedBy,
            partyName, selection, productName, discPer, cgst, sgst, igst, utgst, rate, addCode, totalAmt,
            items
        } = req.body;
        // Insert into Orders table
        const orderResult = await connection.request()
            .input('docNo', sql.VarChar, docNo)
            .input('docDate', sql.DateTime, docDate)
            .input('orderNo', sql.VarChar, orderNo)
            .input('orderDate', sql.DateTime, orderDate)
            .input('pageNo', sql.VarChar, pageNo)
            .input('partyCode', sql.VarChar, partyCode)
            .input('billAmt', sql.Decimal, billAmt)
            .input('totalQty', sql.Decimal, totalQty)
            .input('netAmt', sql.Decimal, netAmt)
            .input('taxAmt', sql.Decimal, taxAmt)
            .input('discAmt', sql.Decimal, discAmt)
            .input('mainType', sql.VarChar, mainType)
            .input('subType', sql.VarChar, subType)
            .input('type', sql.VarChar, type)
            .input('prefix', sql.VarChar, prefix)
            .input('narration', sql.VarChar, narration)
            .input('userId', sql.Int, userId)
            .input('companyId', sql.Int, companyId)
            .input('createdBy', sql.Int, createdBy)
            .input('modifiedBy', sql.Int, modifiedBy)
            .input('partyName', sql.VarChar, partyName)
            .input('selection', sql.VarChar, selection)
            .input('productName', sql.VarChar, productName)
            .input('discPer', sql.Decimal, discPer)
            .input('cgst', sql.Decimal, cgst)
            .input('sgst', sql.Decimal, sgst)
            .input('igst', sql.Decimal, igst)
            .input('utgst', sql.Decimal, utgst)
            .input('rate', sql.Decimal, rate)
            .input('addCode', sql.VarChar, addCode)
            .input('totalAmt', sql.Decimal, totalAmt)
            .query(`
                INSERT INTO [Orders] (
                    DocNo, DocDate, PageNo, OrederNo, OrderDate, PartyCode, BillAmt, TotalQty, NetAmt, TaxAmt, DiscAmt,
                    MainType, SubType, Type, Prefix, Narration, UserID, CompanyID, CreatedBy, CreatedDate,
                    ModifiedBy, ModifiedDate, PartyName, Selection, ProductName, DiscPer, CGST, SGST, IGST, UTGST, Rate, TotalAmt, AddCode
                )
                OUTPUT INSERTED.OrderID
                VALUES (
                    @docNo, @docDate, @pageNo, @orderNo, @orderDate, @partyCode, @billAmt, @totalQty, @netAmt,
                    @taxAmt, @discAmt, @mainType, @subType, @type, @prefix, @narration, @userId,
                    @companyId, @createdBy, GETDATE(), @modifiedBy, GETDATE(), @partyName, @selection,
                    @productName, @discPer, @cgst, @sgst, @igst, @utgst, @rate, ROUND(@totalAmt, 0), @addCode
                )
            `);

        if (!orderResult.recordset || orderResult.recordset.length === 0) {
            throw new Error('Failed to insert order: No OrderID returned');
        }

        const orderId = orderResult.recordset[0].OrderID;
        // Insert items into OrdersStk table
        for (const item of items) {
            await connection.request()
                .input('srl', sql.VarChar, item.srl)
                .input('sNo', sql.VarChar, item.sNo)
                .input('currName', sql.VarChar, item.currName)
                .input('currRate', sql.Decimal, item.currRate)
                .input('docDate', sql.DateTime, item.docDate)
                .input('itemCode', sql.VarChar, item.itemCode)
                .input('qty', sql.Decimal, item.qty)
                .input('rate', sql.Decimal, item.rate)
                .input('disc', sql.Decimal, item.disc)
                .input('amt', sql.Decimal, item.amt)
                .input('partyCode', sql.VarChar, item.partyCode)
                .input('storeCode', sql.VarChar, item.storeCode)
                .input('mainType', sql.VarChar, item.mainType)
                .input('subType', sql.VarChar, item.subType)
                .input('type', sql.VarChar, item.type)
                .input('prefix', sql.VarChar, item.prefix)
                .input('narration', sql.VarChar, item.narration)
                .input('branchCode', sql.VarChar, item.branchCode)
                .input('unit', sql.VarChar, item.unit)
                .input('discAmt', sql.Decimal, item.discAmt)
                .input('mrp', sql.Decimal, item.mrp)
                .input('newRate', sql.Decimal, item.newRate)
                .input('taxCode', sql.VarChar, item.taxCode)
                .input('taxAmt', sql.Decimal, item.taxAmt)
                .input('cessAmt', sql.Decimal, item.cessAmt)
                .input('taxable', sql.Decimal, item.taxable)
                .input('barcodeValue', sql.VarChar, item.barcodeValue)
                .input('userId', sql.Int, item.userId)
                .input('companyId', sql.Int, item.companyId)
                .input('createdBy', sql.Int, item.createdBy)
                .input('modifiedBy', sql.Int, item.modifiedBy)
                .input('cgst', sql.Decimal, item.cgst)
                .input('sgst', sql.Decimal, item.sgst)
                .input('igst', sql.Decimal, item.igst)
                .input('utgst', sql.Decimal, item.utgst)
                .input('pnding', sql.Decimal, item.pnding)
                .input('delivaryDate', sql.DateTime, item.delivaryDate)
                // ... (add all other inputs for item)
                .query(`
                        INSERT INTO OrdersStk (
                            SRL, SNo, CurrName, CurrRate, DocDate, ItemCode, Qty, Rate, Disc, Amt, PartyCode,
                            StoreCode, MainType, SubType, Type, Prefix, Narration, BranchCode, Unit, DiscAmt,
                            MRP, NewRate, TaxCode, TaxAmt, CessAmt, Taxable, BarcodeValue, UserID, CompanyID,
                            CreatedBy, CreatedDate, ModifiedBy, ModifiedDate, CGST, SGST, IGST, UTGST, Pnding,
                            ChallanPanding, DelivaryDate
                        )
                        VALUES (
                            @srl, @sNo, @currName, @currRate, @docDate, @itemCode, @qty, @rate, @disc, ROUND(@amt, 0),
                            @partyCode, @storeCode, @mainType, @subType, @type, @prefix, @narration, @branchCode,
                            @unit, @discAmt, @mrp, @newRate, @taxCode, @taxAmt, @cessAmt, @taxable, @barcodeValue,
                            @userId, @companyId, @createdBy, GETDATE(), @modifiedBy, GETDATE(), @cgst, @sgst, @igst,
                            @utgst, @pnding, @pnding, @delivaryDate
                        )
                    `);
        }

        res.status(201).json({ message: 'Order created successfully', orderId: orderId });
    } catch (err: any) {
        console.error('Error creating order:', err);
        res.status(500).json({ error: 'An error occurred while creating the order', details: err.message });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.get('/invoice-items', async (req: Request, res: Response) => {
    let pool;
    try {
        // Get values from headers
        const userID = req.header('UserID');
        const companyID = req.header('CompanyID');
        const prefix = req.header('Prefix');

        // Validate headers
        if (!userID || !companyID || !prefix) {
            return res.status(400).json({ error: "Missing required headers: UserID, CompanyID, or Prefix" });
        }

        pool = await sql.connect(dbConfig);

        // Query for items
        const itemsRequest = pool.request();
        itemsRequest.input('UserID', sql.Int, parseInt(userID));
        itemsRequest.input('CompanyID', sql.Int, parseInt(companyID));

        const itemsQuery = `
            SELECT [ItemID], [ItemCode], [ItemName], [PurRate], [PurDisc], [SalRate], [SalDisc],
                   [Barcode], [OpeningStock], [Unit], [MRP], [TaxCode], [UserID], [CompanyID],
                   [CreatedBy], [CreatedDate], [ModifiedBy], [ModifiedDate], [GroupCode], [Flag],
                   [HSNCode], [TaxCategory], [GSTTaxCode], [IGSTTaxCode], [UTGSTTaxCode], [imgPath],
                   [Catagri], [grosswegiht], [netwegiht], [purity], [print], [makingcharge], [Othercharge]
            FROM [QuickbillBook].[dbo].[ItemMaster] 
            WHERE UserID = @UserID AND CompanyID = @CompanyID ORDER BY ItemName ASC`;

        const itemsResult = await itemsRequest.query(itemsQuery);

        // Query for last serial code
        const serialRequest = pool.request();
        serialRequest.input('UserID', sql.Int, parseInt(userID));
        serialRequest.input('CompanyID', sql.Int, parseInt(companyID));
        serialRequest.input('Prefix', sql.VarChar, prefix);

        const serialQuery = `
            Select top 1 isnull(DocNo,0) as SRL from sales 
						where 
						 [Type]='SAL' 
						and Prefix=@Prefix
						and CompanyID=@CompanyID
						and UserID=@UserID
						order by DocNo desc`;



        const serialResult = await serialRequest.query(serialQuery);

        const lastSerial = serialResult.recordset[0]?.SRL || '0';
        const nextSerialNumber = parseInt(lastSerial) + 1;
        const nextSerial = nextSerialNumber.toString().padStart(6, '0');

        res.json({
            items: itemsResult.recordset,
            lastSerial: lastSerial,
            nextSerial: nextSerial
        });

    } catch (error) {
        console.error("Error while fetching items and serial", error);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        if (pool) {
            await pool.close();
        }
    }
});

app.post('/api/create-invoice', async (req: Request, res: Response) => {
    let connection;

    try {
        connection = await sql.connect(dbConfig);
        const {
            customerCode, docNo, docDate, billNo, billDate, partyCode, billAmt, totalQty, netAmt, taxAmt, discAmt,
            mainType, subType, type, prefix, narration, userId, companyId, createdBy, modifiedBy,
            partyName, selection, productName, discPer, cgst, sgst, igst, utgst, rate, totalAmt,
            status, addCode, roundoff, extrCharch, discountExtra, exchargelager,
            refVoucherNo, refVoucherDate, fileName, transpoter, lrNo, eWayBillNo, modeofTarn,
            dispatch, noPackage, eInvRemarks, placeOfSuply,
            items
        } = req.body;

        // Insert into Sales table
        const saleResult = await connection.request()
            .input('docNo', sql.VarChar, docNo)
            .input('docDate', sql.DateTime, docDate)
            .input('billNo', sql.VarChar, billNo)
            .input('billDate', sql.DateTime, billDate)
            .input('partyCode', sql.VarChar, partyCode)
            .input('billAmt', sql.Decimal, billAmt)
            .input('totalQty', sql.Decimal, totalQty)
            .input('netAmt', sql.Decimal, netAmt)
            .input('taxAmt', sql.Decimal, taxAmt)
            .input('discAmt', sql.Decimal, discAmt)
            .input('mainType', sql.VarChar, mainType)
            .input('subType', sql.VarChar, subType)
            .input('type', sql.VarChar, type)
            .input('prefix', sql.VarChar, prefix)
            .input('narration', sql.VarChar, narration)
            .input('userId', sql.Int, userId)
            .input('companyId', sql.Int, companyId)
            .input('createdBy', sql.Int, createdBy)
            .input('modifiedBy', sql.Int, modifiedBy)
            .input('partyName', sql.VarChar, partyName)
            .input('selection', sql.VarChar, selection)
            .input('productName', sql.VarChar, productName)
            .input('discPer', sql.Decimal, discPer)
            .input('cgst', sql.Decimal, cgst)
            .input('sgst', sql.Decimal, sgst)
            .input('igst', sql.Decimal, igst)
            .input('utgst', sql.Decimal, utgst)
            .input('rate', sql.Decimal, rate)
            .input('totalAmt', sql.Decimal, totalAmt)
            .input('status', sql.VarChar, status)
            .input('addCode', sql.VarChar, addCode)
            .input('roundoff', sql.Decimal, roundoff)
            .input('extrCharch', sql.Decimal, extrCharch)
            .input('discountExtra', sql.Decimal, discountExtra)
            .input('exchargelager', sql.VarChar, exchargelager)
            .input('refVoucherNo', sql.VarChar, refVoucherNo)
            .input('refVoucherDate', sql.DateTime, refVoucherDate)
            .input('fileName', sql.VarChar, fileName)
            .input('transpoter', sql.VarChar, transpoter)
            .input('lrNo', sql.VarChar, lrNo)
            .input('eWayBillNo', sql.VarChar, eWayBillNo)
            .input('modeofTarn', sql.VarChar, modeofTarn)
            .input('dispatch', sql.VarChar, dispatch)
            .input('noPackage', sql.VarChar, noPackage)
            .input('eInvRemarks', sql.VarChar, eInvRemarks)
            .input('placeOfSuply', sql.VarChar, placeOfSuply)
            .query(`
                INSERT INTO [Sales] (
                    DocNo, DocDate, BillNo, BillDate, PartyCode, BillAmt, TotalQty, NetAmt, TaxAmt, 
                    DiscAmt, MainType, SubType, Type, Prefix, Narration, UserID, CompanyID, CreatedBy, 
                    CreatedDate, ModifiedBy, ModifiedDate, PartyName, Selection, ProductName, DiscPer, 
                    CGST, SGST, IGST, UTGST, Rate, TotalAmt, Status, AddCode, Roundoff, ExtrCharch, 
                    DiscountExtra, Exchargelager, RefVoucherNo, RefVoucherDate, FileName, Transpoter, 
                    LRNo, EWayBillNo, ModeofTarn, Dispatch, NoPackage, eInvRemarks, PlaceOfSuply
                )
                OUTPUT INSERTED.SalesID
                VALUES (
                    @docNo, @docDate, @billNo, @billDate, @partyCode, @billAmt, @totalQty, @netAmt,
                    @taxAmt, @discAmt, @mainType, @subType, @type, @prefix, @narration, @userId,
                    @companyId, @createdBy, GETDATE(), @modifiedBy, GETDATE(), @partyName, @selection,
                    @productName, @discPer, @cgst, @sgst, @igst, @utgst, @rate, ROUND(@totalAmt, 0),
                    @status, @addCode, @roundoff, @extrCharch, @discountExtra, @exchargelager,
                    @refVoucherNo, @refVoucherDate, @fileName, @transpoter, @lrNo, @eWayBillNo,
                    @modeofTarn, @dispatch, @noPackage, @eInvRemarks, @placeOfSuply
                )
            `);

        if (!saleResult.recordset || saleResult.recordset.length === 0) {
            throw new Error('Failed to insert sale: No SalesID returned');
        }

        const salesId = saleResult.recordset[0].SalesID;

        // Insert items into Stock table (similar to OrdersStk)
        for (const item of items) {
            await connection.request()
                .input('srl', sql.VarChar, item.srl)
                .input('sNo', sql.VarChar, item.sNo)
                .input('currName', sql.VarChar, item.currName)
                .input('currRate', sql.Decimal, item.currRate)
                .input('docDate', sql.DateTime, item.docDate)
                .input('itemCode', sql.VarChar, item.itemCode)
                .input('qty', sql.Decimal, item.qty)
                .input('rate', sql.Decimal, item.rate)
                .input('disc', sql.Decimal, item.disc)
                .input('amt', sql.Decimal, item.amt)
                .input('partyCode', sql.VarChar, item.partyCode)
                .input('storeCode', sql.VarChar, item.storeCode)
                .input('mainType', sql.VarChar, item.mainType)
                .input('subType', sql.VarChar, item.subType)
                .input('type', sql.VarChar, item.type)
                .input('prefix', sql.VarChar, item.prefix)
                .input('narration', sql.VarChar, item.narration)
                .input('branchCode', sql.VarChar, item.branchCode)
                .input('unit', sql.VarChar, item.unit)
                .input('discAmt', sql.Decimal, item.discAmt)
                .input('mrp', sql.Decimal, item.mrp)
                .input('newRate', sql.Decimal, item.newRate)
                .input('taxCode', sql.VarChar, item.taxCode)
                .input('taxAmt', sql.Decimal, item.taxAmt)
                .input('cessAmt', sql.Decimal, item.cessAmt)
                .input('taxable', sql.Decimal, item.taxable)
                .input('barcodeValue', sql.VarChar, item.barcodeValue)
                .input('userId', sql.Int, item.userId)
                .input('companyId', sql.Int, item.companyId)
                .input('createdBy', sql.Int, item.createdBy)
                .input('modifiedBy', sql.Int, item.modifiedBy)
                .input('cgst', sql.Decimal, item.cgst)
                .input('sgst', sql.Decimal, item.sgst)
                .input('igst', sql.Decimal, item.igst)
                .input('utgst', sql.Decimal, item.utgst)
                .input('pnding', sql.Decimal, item.pnding)
                .input('colours', sql.VarChar, item.colours)
                .input('s1', sql.VarChar, item.s1)
                .input('q1', sql.Decimal, item.q1)
                .input('s2', sql.VarChar, item.s2)
                .input('q2', sql.Decimal, item.q2)
                .input('s3', sql.VarChar, item.s3)
                .input('q3', sql.Decimal, item.q3)
                .input('s4', sql.VarChar, item.s4)
                .input('q4', sql.Decimal, item.q4)
                .input('s5', sql.VarChar, item.s5)
                .input('q5', sql.Decimal, item.q5)
                .input('s6', sql.VarChar, item.s6)
                .input('q6', sql.Decimal, item.q6)
                .input('s7', sql.VarChar, item.s7)
                .input('q7', sql.Decimal, item.q7)
                .input('s8', sql.VarChar, item.s8)
                .input('q8', sql.Decimal, item.q8)
                .input('s9', sql.VarChar, item.s9)
                .input('q9', sql.Decimal, item.q9)
                .query(`
                    INSERT INTO Stock (
                        SRL, SNo, CurrName, CurrRate, DocDate, ItemCode, Qty, Rate, Disc, Amt,
                        PartyCode, StoreCode, MainType, SubType, Type, Prefix, Narration,
                        BranchCode, Unit, DiscAmt, MRP, NewRate, TaxCode, TaxAmt, CessAmt,
                        Taxable, BarcodeValue, UserID, CompanyID, CreatedBy, CreatedDate,
                        ModifiedBy, ModifiedDate, CGST, SGST, IGST, UTGST, Pnding,
                        Colours, S1, Q1, S2, Q2, S3, Q3, S4, Q4, S5, Q5, S6, Q6, S7, Q7, S8, Q8, S9, Q9
                    )
                    VALUES (
                        @srl, @sNo, @currName, @currRate, @docDate, @itemCode, @qty, @rate,
                        @disc, ROUND(@amt, 0), @partyCode, @storeCode, @mainType, @subType,
                        @type, @prefix, @narration, @branchCode, @unit, @discAmt, @mrp,
                        @newRate, @taxCode, @taxAmt, @cessAmt, @taxable, @barcodeValue,
                        @userId, @companyId, @createdBy, GETDATE(), @modifiedBy, GETDATE(),
                        @cgst, @sgst, @igst, @utgst, @pnding, @colours,
                        @s1, @q1, @s2, @q2, @s3, @q3, @s4, @q4, @s5, @q5,
                        @s6, @q6, @s7, @q7, @s8, @q8, @s9, @q9
                    )
                `);
        }



        // After successful sales insertion, add Ledger entries
        const transactionNumber = Math.floor(Math.random() * 1000000).toString(); // Generate random transaction number

        // 1. Insert Net Amount (Debit)
        await connection.request()
            .input('Sno', sql.VarChar, '1')
            .input('CurrName', sql.VarChar, '')
            .input('CurrRate', sql.Decimal, 0.00)
            .input('MainType', sql.VarChar, 'SL')
            .input('SubType', sql.VarChar, 'RS')
            .input('Type', sql.VarChar, 'SAL')
            .input('Srl', sql.VarChar, docNo)
            .input('DocDate', sql.DateTime, docDate)
            .input('Code', sql.VarChar, customerCode)
            .input('Debit', sql.Decimal, billAmt)
            .input('Credit', sql.Decimal, 0.00)
            .input('Cheque', sql.VarChar, '')
            .input('RecoFlag', sql.VarChar, '0')
            .input('ClearDate', sql.DateTime, null)
            .input('Narr', sql.VarChar, narration)
            .input('Prefix', sql.VarChar, prefix)
            .input('Branch', sql.VarChar, '')
            .input('AltCode', sql.VarChar, '777777777')
            .input('Party', sql.VarChar, customerCode)
            .input('BillNumber', sql.VarChar, billNo)
            .input('BillDate', sql.DateTime, billDate)
            .input('ChequeDate', sql.DateTime, billDate)
            .input('DraweeBranch', sql.VarChar, '')
            .input('AccountName', sql.VarChar, '')
            .input('ReferenceCode', sql.VarChar, '')
            .input('UserID', sql.Int, userId)
            .input('CompanyID', sql.Int, companyId)
            .input('CreatedBy', sql.Int, createdBy)
            .input('ModifiedBy', sql.Int, modifiedBy)
            .input('aSrl', sql.VarChar, docNo)
            .input('aMainType', sql.VarChar, 'PR')
            .input('aSubType', sql.VarChar, 'RP')
            .input('aType', sql.VarChar, 'PUR')
            .input('aPrefix', sql.VarChar, prefix)
            .input('TransactionNumber', sql.VarChar, transactionNumber)
            .query(`INSERT INTO Ledger
           ([Sno]
           ,[CurrName]
           ,[CurrRate]
           ,[MainType]
           ,[SubType]
           ,[Type]
           ,[Srl]
           ,[DocDate]
           ,[Code]
           ,[Debit]
           ,[Credit]
           ,[Cheque]
           ,[RecoFlag]
           ,[ClearDate]
           ,[Narr]
           ,[Prefix]
           ,[Branch]
           ,[AltCode]
           ,[Party]
           ,[BillNumber]
           ,[BillDate]
           ,[ChequeDate]
           ,[DraweeBranch]
           ,[AccountName]
           ,[ReferenceCode]
           ,[UserID]
           ,[CompanyID]
           ,[CreatedBy]
           ,[CreatedDate]
           ,[ModifiedBy]
           ,[ModifiedDate]
           ,[aSRL]
           ,[aMainType]
           ,[aSubType]
           ,[aType]
           ,[aPrefix]
           ,TransactionNumber)
     VALUES
           (@Sno
           ,@CurrName
           ,@CurrRate 
           ,@MainType
           ,@SubType
           ,@Type
           ,@Srl
           ,@DocDate
           ,@Code
           ,@Debit
           ,@Credit
           ,@Cheque
           ,@RecoFlag
           ,@ClearDate
           ,@Narr
           ,@Prefix
           ,@Branch
           ,@AltCode
           ,@Party
           ,@BillNumber
           ,@BillDate
           ,@ChequeDate
           ,@DraweeBranch
           ,@AccountName
           ,@ReferenceCode
           ,@UserID
           ,@CompanyID
           ,@CreatedBy
           ,GETDATE()
           ,@ModifiedBy
           ,GETDATE()
           ,@aSrl
           ,@aMainType
           ,@aSubType
           ,@aType
           ,@aPrefix
           ,@TransactionNumber)`);

        // 2. Insert Discount Amount (Credit)
        if (netAmt > 0) {
            await connection.request()
                .input('Sno', sql.VarChar, '2')
                .input('CurrName', sql.VarChar, '')
                .input('CurrRate', sql.Decimal, 0.00)
                .input('MainType', sql.VarChar, 'SL')
                .input('SubType', sql.VarChar, 'RS')
                .input('Type', sql.VarChar, 'SAL')
                .input('Srl', sql.VarChar, docNo)
                .input('DocDate', sql.DateTime, docDate)
                .input('Code', sql.VarChar, '777777777')
                .input('Debit', sql.Decimal, 0.00)
                .input('Credit', sql.Decimal, netAmt)
                .input('Cheque', sql.VarChar, '')
                .input('RecoFlag', sql.VarChar, '0')
                .input('ClearDate', sql.DateTime, docDate)
                .input('Narr', sql.VarChar, narration)
                .input('Prefix', sql.VarChar, prefix)
                .input('Branch', sql.VarChar, '')
                .input('AltCode', sql.VarChar, customerCode)
                .input('Party', sql.VarChar, customerCode)
                .input('BillNumber', sql.VarChar, billNo)
                .input('BillDate', sql.DateTime, billDate)
                .input('ChequeDate', sql.DateTime, billDate)
                .input('DraweeBranch', sql.VarChar, '')
                .input('AccountName', sql.VarChar, '')
                .input('ReferenceCode', sql.VarChar, '')
                .input('UserID', sql.Int, userId)
                .input('CompanyID', sql.Int, companyId)
                .input('CreatedBy', sql.Int, createdBy)
                .input('ModifiedBy', sql.Int, modifiedBy)
                .input('aSrl', sql.VarChar, docNo)
                .input('aMainType', sql.VarChar, 'PR')
                .input('aSubType', sql.VarChar, 'RP')
                .input('aType', sql.VarChar, 'PUR')
                .input('aPrefix', sql.VarChar, prefix)
                .input('TransactionNumber', sql.VarChar, transactionNumber)
                .query(`INSERT INTO Ledger
           ([Sno]
           ,[CurrName]
           ,[CurrRate]
           ,[MainType]
           ,[SubType]
           ,[Type]
           ,[Srl]
           ,[DocDate]
           ,[Code]
           ,[Debit]
           ,[Credit]
           ,[Cheque]
           ,[RecoFlag]
           ,[ClearDate]
           ,[Narr]
           ,[Prefix]
           ,[Branch]
           ,[AltCode]
           ,[Party]
           ,[BillNumber]
           ,[BillDate]
           ,[ChequeDate]
           ,[DraweeBranch]
           ,[AccountName]
           ,[ReferenceCode]
           ,[UserID]
           ,[CompanyID]
           ,[CreatedBy]
           ,[CreatedDate]
           ,[ModifiedBy]
           ,[ModifiedDate]
           ,[aSRL]
           ,[aMainType]
           ,[aSubType]
           ,[aType]
           ,[aPrefix]
           ,TransactionNumber)
     VALUES
           (@Sno
           ,@CurrName
           ,@CurrRate 
           ,@MainType
           ,@SubType
           ,@Type
           ,@Srl
           ,@DocDate
           ,@Code
           ,@Debit
           ,@Credit
           ,@Cheque
           ,@RecoFlag
           ,@ClearDate
           ,@Narr
           ,@Prefix
           ,@Branch
           ,@AltCode
           ,@Party
           ,@BillNumber
           ,@BillDate
           ,@ChequeDate
           ,@DraweeBranch
           ,@AccountName
           ,@ReferenceCode
           ,@UserID
           ,@CompanyID
           ,@CreatedBy
           ,GETDATE()
           ,@ModifiedBy
           ,GETDATE()
           ,@aSrl
           ,@aMainType
           ,@aSubType
           ,@aType
           ,@aPrefix
           ,@TransactionNumber)`);
        }

        // 3. Insert CGST Amount (Credit)
        if (cgst > 0) {
            await connection.request()
                .input('Sno', sql.VarChar, '3')
                .input('CurrName', sql.VarChar, '')
                .input('CurrRate', sql.Decimal, 0.00)
                .input('MainType', sql.VarChar, 'SL')
                .input('SubType', sql.VarChar, 'RS')
                .input('Type', sql.VarChar, 'SAL')
                .input('Srl', sql.VarChar, docNo)
                .input('DocDate', sql.DateTime, docDate)
                .input('Code', sql.VarChar, '999999999')
                .input('Debit', sql.Decimal, 0.00)
                .input('Credit', sql.Decimal, cgst)
                .input('Cheque', sql.VarChar, '')
                .input('RecoFlag', sql.VarChar, '0')
                .input('ClearDate', sql.DateTime, docDate)
                .input('Narr', sql.VarChar, narration)
                .input('Prefix', sql.VarChar, prefix)
                .input('Branch', sql.VarChar, '')
                .input('AltCode', sql.VarChar, customerCode)
                .input('Party', sql.VarChar, customerCode)
                .input('BillNumber', sql.VarChar, billNo)
                .input('BillDate', sql.DateTime, billDate)
                .input('ChequeDate', sql.DateTime, billDate)
                .input('DraweeBranch', sql.VarChar, '')
                .input('AccountName', sql.VarChar, '')
                .input('ReferenceCode', sql.VarChar, '')
                .input('UserID', sql.Int, userId)
                .input('CompanyID', sql.Int, companyId)
                .input('CreatedBy', sql.Int, createdBy)
                .input('ModifiedBy', sql.Int, modifiedBy)
                .input('aSrl', sql.VarChar, docNo)
                .input('aMainType', sql.VarChar, 'PR')
                .input('aSubType', sql.VarChar, 'RP')
                .input('aType', sql.VarChar, 'PUR')
                .input('aPrefix', sql.VarChar, prefix)
                .input('TransactionNumber', sql.VarChar, transactionNumber)
                .query(`INSERT INTO Ledger
           ([Sno]
           ,[CurrName]
           ,[CurrRate]
           ,[MainType]
           ,[SubType]
           ,[Type]
           ,[Srl]
           ,[DocDate]
           ,[Code]
           ,[Debit]
           ,[Credit]
           ,[Cheque]
           ,[RecoFlag]
           ,[ClearDate]
           ,[Narr]
           ,[Prefix]
           ,[Branch]
           ,[AltCode]
           ,[Party]
           ,[BillNumber]
           ,[BillDate]
           ,[ChequeDate]
           ,[DraweeBranch]
           ,[AccountName]
           ,[ReferenceCode]
           ,[UserID]
           ,[CompanyID]
           ,[CreatedBy]
           ,[CreatedDate]
           ,[ModifiedBy]
           ,[ModifiedDate]
           ,[aSRL]
           ,[aMainType]
           ,[aSubType]
           ,[aType]
           ,[aPrefix]
           ,TransactionNumber)
     VALUES
           (@Sno
           ,@CurrName
           ,@CurrRate 
           ,@MainType
           ,@SubType
           ,@Type
           ,@Srl
           ,@DocDate
           ,@Code
           ,@Debit
           ,@Credit
           ,@Cheque
           ,@RecoFlag
           ,@ClearDate
           ,@Narr
           ,@Prefix
           ,@Branch
           ,@AltCode
           ,@Party
           ,@BillNumber
           ,@BillDate
           ,@ChequeDate
           ,@DraweeBranch
           ,@AccountName
           ,@ReferenceCode
           ,@UserID
           ,@CompanyID
           ,@CreatedBy
           ,GETDATE()
           ,@ModifiedBy
           ,GETDATE()
           ,@aSrl
           ,@aMainType
           ,@aSubType
           ,@aType
           ,@aPrefix
           ,@TransactionNumber)`);
        }


        if (sgst > 0) {
            await connection.request()
                .input('Sno', sql.VarChar, '4')
                .input('CurrName', sql.VarChar, '')
                .input('CurrRate', sql.Decimal, 0.00)
                .input('MainType', sql.VarChar, 'SL')
                .input('SubType', sql.VarChar, 'RS')
                .input('Type', sql.VarChar, 'SAL')
                .input('Srl', sql.VarChar, docNo)
                .input('DocDate', sql.DateTime, docDate)
                .input('Code', sql.VarChar, '999999998')
                .input('Debit', sql.Decimal, 0.00)
                .input('Credit', sql.Decimal, sgst)
                .input('Cheque', sql.VarChar, '')
                .input('RecoFlag', sql.VarChar, '0')
                .input('ClearDate', sql.DateTime, docDate)
                .input('Narr', sql.VarChar, narration)
                .input('Prefix', sql.VarChar, prefix)
                .input('Branch', sql.VarChar, '')
                .input('AltCode', sql.VarChar, customerCode)
                .input('Party', sql.VarChar, customerCode)
                .input('BillNumber', sql.VarChar, billNo)
                .input('BillDate', sql.DateTime, billDate)
                .input('ChequeDate', sql.DateTime, billDate)
                .input('DraweeBranch', sql.VarChar, '')
                .input('AccountName', sql.VarChar, '')
                .input('ReferenceCode', sql.VarChar, '')
                .input('UserID', sql.Int, userId)
                .input('CompanyID', sql.Int, companyId)
                .input('CreatedBy', sql.Int, createdBy)
                .input('ModifiedBy', sql.Int, modifiedBy)
                .input('aSrl', sql.VarChar, docNo)
                .input('aMainType', sql.VarChar, 'PR')
                .input('aSubType', sql.VarChar, 'RP')
                .input('aType', sql.VarChar, 'PUR')
                .input('aPrefix', sql.VarChar, prefix)
                .input('TransactionNumber', sql.VarChar, transactionNumber)
                .query(`
                    INSERT INTO Ledger (
                        Sno, CurrName, CurrRate, MainType, SubType, Type, Srl, DocDate,
                        Code, Debit, Credit, Cheque, RecoFlag, ClearDate, Narr, Prefix,
                        Branch, AltCode, Party, BillNumber, BillDate, ChequeDate,
                        DraweeBranch, AccountName, ReferenceCode, UserID, CompanyID,
                        CreatedBy, CreatedDate, ModifiedBy, ModifiedDate, aSRL,
                        aMainType, aSubType, aType, aPrefix, TransactionNumber
                    )
                    VALUES (
                        @Sno, @CurrName, @CurrRate, @MainType, @SubType, @Type, @Srl,
                        @DocDate, @Code, @Debit, @Credit, @Cheque, @RecoFlag, @ClearDate,
                        @Narr, @Prefix, @Branch, @AltCode, @Party, @BillNumber, @BillDate,
                        @ChequeDate, @DraweeBranch, @AccountName, @ReferenceCode, @UserID,
                        @CompanyID, @CreatedBy, GETDATE(), @ModifiedBy, GETDATE(), @aSrl,
                        @aMainType, @aSubType, @aType, @aPrefix, @TransactionNumber
                    )`);
        }

        // Insert into Outstanding table
        const outstandingQuery = `
            INSERT INTO Outstanding (
                Branch, MainType, SubType, Type, Prefix, Srl, Sno,
                aMainType, aSubType, aType, aPrefix, aSerial, aSno,
                CurrName, CurrRate, DocDate, Code, Amount, Pending,
                Flag, BillNumber, BillDate, CrPeriod, TdsAmt,
                OpnPending, OrdNumber, OrdDate, OpFlag, RefParty,
                Remark, ncode, AdvanceWithGST, UserID, CompanyID,
                TransactionNumber, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
            )
            VALUES (
                @Branch, @MainType, @SubType, @Type, @Prefix, @Srl, @Sno,
                @aMainType, @aSubType, @aType, @aPrefix, @aSerial, @aSno,
                @CurrName, @CurrRate, @DocDate, @Code, ROUND(@Amount, 0), ROUND(@Pending, 0),
                @Flag, @BillNumber, @BillDate, @CrPeriod, @TdsAmt,
                @OpnPending, @OrdNumber, @OrdDate, @OpFlag, @RefParty,
                @Remark, @ncode, @AdvanceWithGST, @UserID, @CompanyID,
                @TransactionNumber, @CreatedBy, GETDATE(), @ModifiedBy, GETDATE()
            )`;

        await connection.request()
            .input('Branch', sql.VarChar(6), '')
            .input('MainType', sql.VarChar(2), 'SL')
            .input('SubType', sql.VarChar(2), 'RS')
            .input('Type', sql.VarChar(3), 'SAL')
            .input('Prefix', sql.VarChar(8), prefix)
            .input('Srl', sql.VarChar(35), docNo)
            .input('Sno', sql.VarChar(5), '00001')
            .input('aMainType', sql.VarChar(2), 'SL')
            .input('aSubType', sql.VarChar(2), 'RS')
            .input('aType', sql.VarChar(3), 'SAL')
            .input('aPrefix', sql.VarChar(8), prefix)
            .input('aSerial', sql.VarChar(35), docNo)
            .input('aSno', sql.VarChar(5), '00001')
            .input('CurrName', sql.VarChar(10), '')
            .input('CurrRate', sql.Money, 0)
            .input('DocDate', sql.DateTime, docDate)
            .input('Code', sql.VarChar(30), customerCode)
            .input('Amount', sql.Money, billAmt)
            .input('Pending', sql.Money, billAmt)
            .input('Flag', sql.VarChar(1), 'D')
            .input('BillNumber', sql.VarChar(255), billNo)
            .input('BillDate', sql.DateTime, billDate)
            .input('CrPeriod', sql.Int, 0)
            .input('TdsAmt', sql.Money, 0)
            .input('OpnPending', sql.Money, 0)
            .input('OrdNumber', sql.VarChar(255), '')
            .input('OrdDate', sql.DateTime, null)
            .input('OpFlag', sql.VarChar(1), '')
            .input('RefParty', sql.VarChar(9), '')
            .input('Remark', sql.VarChar(500), '')
            .input('ncode', sql.VarChar(50), '')
            .input('AdvanceWithGST', sql.Bit, 0)
            .input('UserID', sql.Int, userId)
            .input('CompanyID', sql.Int, companyId)
            .input('TransactionNumber', sql.VarChar(50), transactionNumber)
            .input('CreatedBy', sql.Int, createdBy)
            .input('ModifiedBy', sql.Int, modifiedBy)
            .query(outstandingQuery);

        res.status(201).json({
            message: 'Invoice and Outstanding entry created successfully'
        });



    } catch (err: any) {
        console.error('Error creating invoice:', err);
        res.status(500).json({ error: 'An error occurred while creating the invoice', details: err.message });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.get('/return-items', async (req: Request, res: Response) => {
    let pool;
    try {
        // Get values from headers
        const userID = req.header('UserID');
        const companyID = req.header('CompanyID');
        const prefix = req.header('Prefix');

        // Validate headers
        if (!userID || !companyID || !prefix) {
            return res.status(400).json({ error: "Missing required headers: UserID, CompanyID, or Prefix" });
        }

        pool = await sql.connect(dbConfig);

        // Query for items
        const itemsRequest = pool.request();
        itemsRequest.input('UserID', sql.Int, parseInt(userID));
        itemsRequest.input('CompanyID', sql.Int, parseInt(companyID));

        const itemsQuery = `
            SELECT [ItemID], [ItemCode], [ItemName], [PurRate], [PurDisc], [SalRate], [SalDisc],
                   [Barcode], [OpeningStock], [Unit], [MRP], [TaxCode], [UserID], [CompanyID],
                   [CreatedBy], [CreatedDate], [ModifiedBy], [ModifiedDate], [GroupCode], [Flag],
                   [HSNCode], [TaxCategory], [GSTTaxCode], [IGSTTaxCode], [UTGSTTaxCode], [imgPath],
                   [Catagri], [grosswegiht], [netwegiht], [purity], [print], [makingcharge], [Othercharge]
            FROM [QuickbillBook].[dbo].[ItemMaster] 
            WHERE UserID = @UserID AND CompanyID = @CompanyID ORDER BY ItemName ASC`;

        const itemsResult = await itemsRequest.query(itemsQuery);

        // Query for last serial code
        const serialRequest = pool.request();
        serialRequest.input('UserID', sql.Int, parseInt(userID));
        serialRequest.input('CompanyID', sql.Int, parseInt(companyID));
        serialRequest.input('Prefix', sql.VarChar, prefix);

        const serialQuery = `
            Select top 1 isnull(DocNo,0) as SRL from sales 
						where 
						 [Type]='SAL' 
						and Prefix=@Prefix
						and CompanyID=@CompanyID
						and UserID=@UserID
						order by DocNo desc`;



        const serialResult = await serialRequest.query(serialQuery);

        const lastSerial = serialResult.recordset[0]?.SRL || '0';
        const nextSerialNumber = parseInt(lastSerial) + 1;
        const nextSerial = nextSerialNumber.toString().padStart(6, '0');

        res.json({
            items: itemsResult.recordset,
            lastSerial: lastSerial,
            nextSerial: nextSerial
        });

    } catch (error) {
        console.error("Error while fetching items and serial", error);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        if (pool) {
            await pool.close();
        }
    }
});

app.post('/api/create-return', async (req: Request, res: Response) => {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const {
            customerCode, docNo, docDate, billNo, billDate, partyCode, billAmt, totalQty, netAmt, taxAmt, discAmt,
            mainType, subType, type, prefix, narration, userId, companyId, createdBy, modifiedBy,
            partyName, selection, productName, discPer, cgst, sgst, igst, utgst, rate, totalAmt,
            status, addCode, roundoff, extrCharch, discountExtra, exchargelager,
            refVoucherNo, refVoucherDate, fileName, transpoter, lrNo, eWayBillNo, modeofTarn,
            dispatch, noPackage, eInvRemarks, placeOfSuply,
            items // Array of items for SalesStk
        } = req.body;

        // Insert into Sales table
        const saleResult = await connection.request()
            .input('customerCode', sql.VarChar, customerCode)
            .input('docNo', sql.VarChar, docNo)
            .input('docDate', sql.DateTime, docDate)
            .input('billNo', sql.VarChar, billNo)
            .input('billDate', sql.DateTime, billDate)
            .input('partyCode', sql.VarChar, partyCode)
            .input('billAmt', sql.Decimal, billAmt)
            .input('totalQty', sql.Decimal, totalQty)
            .input('netAmt', sql.Decimal, netAmt)
            .input('taxAmt', sql.Decimal, taxAmt)
            .input('discAmt', sql.Decimal, discAmt)
            .input('mainType', sql.VarChar, mainType)
            .input('subType', sql.VarChar, subType)
            .input('type', sql.VarChar, type)
            .input('prefix', sql.VarChar, prefix)
            .input('narration', sql.VarChar, narration)
            .input('userId', sql.Int, userId)
            .input('companyId', sql.Int, companyId)
            .input('createdBy', sql.Int, createdBy)
            .input('modifiedBy', sql.Int, modifiedBy)
            .input('partyName', sql.VarChar, partyName)
            .input('selection', sql.VarChar, selection)
            .input('productName', sql.VarChar, productName)
            .input('discPer', sql.Decimal, discPer)
            .input('cgst', sql.Decimal, cgst)
            .input('sgst', sql.Decimal, sgst)
            .input('igst', sql.Decimal, igst)
            .input('utgst', sql.Decimal, utgst)
            .input('rate', sql.Decimal, rate)
            .input('totalAmt', sql.Decimal, totalAmt)
            .input('status', sql.VarChar, status)
            .input('addCode', sql.VarChar, addCode)
            .input('roundoff', sql.Decimal, roundoff)
            .input('extrCharch', sql.Decimal, extrCharch)
            .input('discountExtra', sql.Decimal, discountExtra)
            .input('exchargelager', sql.VarChar, exchargelager)
            .input('refVoucherNo', sql.VarChar, refVoucherNo)
            .input('refVoucherDate', sql.DateTime, refVoucherDate)
            .input('fileName', sql.VarChar, fileName)
            .input('transpoter', sql.VarChar, transpoter)
            .input('lrNo', sql.VarChar, lrNo)
            .input('eWayBillNo', sql.VarChar, eWayBillNo)
            .input('modeofTarn', sql.VarChar, modeofTarn)
            .input('dispatch', sql.VarChar, dispatch)
            .input('noPackage', sql.VarChar, noPackage)
            .input('eInvRemarks', sql.VarChar, eInvRemarks)
            .input('placeOfSuply', sql.VarChar, placeOfSuply)
            .query(`
                INSERT INTO [Sales] (
                    DocNo, DocDate, BillNo, BillDate, PartyCode, BillAmt, TotalQty, NetAmt, TaxAmt, 
                    DiscAmt, MainType, SubType, Type, Prefix, Narration, UserID, CompanyID, CreatedBy, 
                    CreatedDate, ModifiedBy, ModifiedDate, PartyName, Selection, ProductName, DiscPer, 
                    CGST, SGST, IGST, UTGST, Rate, TotalAmt, Status, AddCode, Roundoff, ExtrCharch, 
                    DiscountExtra, Exchargelager, RefVoucherNo, RefVoucherDate, FileName, Transpoter, 
                    LRNo, EWayBillNo, ModeofTarn, Dispatch, NoPackage, eInvRemarks, PlaceOfSuply
                )
                OUTPUT INSERTED.SalesID
                VALUES (
                    @docNo, @docDate, @billNo, @billDate, @partyCode, @billAmt, @totalQty, @netAmt,
                    @taxAmt, @discAmt, @mainType, @subType, @type, @prefix, @narration, @userId,
                    @companyId, @createdBy, GETDATE(), @modifiedBy, GETDATE(), @partyName, @selection,
                    @productName, @discPer, @cgst, @sgst, @igst, @utgst, @rate, ROUND(@totalAmt, 0),
                    @status, @addCode, @roundoff, @extrCharch, @discountExtra, @exchargelager,
                    @refVoucherNo, @refVoucherDate, @fileName, @transpoter, @lrNo, @eWayBillNo,
                    @modeofTarn, @dispatch, @noPackage, @eInvRemarks, @placeOfSuply
                )
            `);

        if (!saleResult.recordset || saleResult.recordset.length === 0) {
            throw new Error('Failed to insert sale: No SalesID returned');
        }

        const salesId = saleResult.recordset[0].SalesID;

        // Insert items into Stock table (similar to OrdersStk)
        for (const item of items) {
            await connection.request()
                .input('srl', sql.VarChar, item.srl)
                .input('sNo', sql.VarChar, item.sNo)
                .input('currName', sql.VarChar, item.currName)
                .input('currRate', sql.Decimal, item.currRate)
                .input('docDate', sql.DateTime, item.docDate)
                .input('itemCode', sql.VarChar, item.itemCode)
                .input('qty', sql.Decimal, item.qty)
                .input('rate', sql.Decimal, item.rate)
                .input('disc', sql.Decimal, item.disc)
                .input('amt', sql.Decimal, item.amt)
                .input('partyCode', sql.VarChar, item.partyCode)
                .input('storeCode', sql.VarChar, item.storeCode)
                .input('mainType', sql.VarChar, item.mainType)
                .input('subType', sql.VarChar, item.subType)
                .input('type', sql.VarChar, item.type)
                .input('prefix', sql.VarChar, item.prefix)
                .input('narration', sql.VarChar, item.narration)
                .input('branchCode', sql.VarChar, item.branchCode)
                .input('unit', sql.VarChar, item.unit)
                .input('discAmt', sql.Decimal, item.discAmt)
                .input('mrp', sql.Decimal, item.mrp)
                .input('newRate', sql.Decimal, item.newRate)
                .input('taxCode', sql.VarChar, item.taxCode)
                .input('taxAmt', sql.Decimal, item.taxAmt)
                .input('cessAmt', sql.Decimal, item.cessAmt)
                .input('taxable', sql.Decimal, item.taxable)
                .input('barcodeValue', sql.VarChar, item.barcodeValue)
                .input('userId', sql.Int, item.userId)
                .input('companyId', sql.Int, item.companyId)
                .input('createdBy', sql.Int, item.createdBy)
                .input('modifiedBy', sql.Int, item.modifiedBy)
                .input('cgst', sql.Decimal, item.cgst)
                .input('sgst', sql.Decimal, item.sgst)
                .input('igst', sql.Decimal, item.igst)
                .input('utgst', sql.Decimal, item.utgst)
                .input('pnding', sql.Decimal, item.pnding)
                .input('colours', sql.VarChar, item.colours)
                .input('s1', sql.VarChar, item.s1)
                .input('q1', sql.Decimal, item.q1)
                .input('s2', sql.VarChar, item.s2)
                .input('q2', sql.Decimal, item.q2)
                .input('s3', sql.VarChar, item.s3)
                .input('q3', sql.Decimal, item.q3)
                .input('s4', sql.VarChar, item.s4)
                .input('q4', sql.Decimal, item.q4)
                .input('s5', sql.VarChar, item.s5)
                .input('q5', sql.Decimal, item.q5)
                .input('s6', sql.VarChar, item.s6)
                .input('q6', sql.Decimal, item.q6)
                .input('s7', sql.VarChar, item.s7)
                .input('q7', sql.Decimal, item.q7)
                .input('s8', sql.VarChar, item.s8)
                .input('q8', sql.Decimal, item.q8)
                .input('s9', sql.VarChar, item.s9)
                .input('q9', sql.Decimal, item.q9)
                .query(`
                    INSERT INTO Stock (
                        SRL, SNo, CurrName, CurrRate, DocDate, ItemCode, Qty, Rate, Disc, Amt,
                        PartyCode, StoreCode, MainType, SubType, Type, Prefix, Narration,
                        BranchCode, Unit, DiscAmt, MRP, NewRate, TaxCode, TaxAmt, CessAmt,
                        Taxable, BarcodeValue, UserID, CompanyID, CreatedBy, CreatedDate,
                        ModifiedBy, ModifiedDate, CGST, SGST, IGST, UTGST, Pnding,
                        Colours, S1, Q1, S2, Q2, S3, Q3, S4, Q4, S5, Q5, S6, Q6, S7, Q7, S8, Q8, S9, Q9
                    )
                    VALUES (
                        @srl, @sNo, @currName, @currRate, @docDate, @itemCode, @qty, @rate,
                        @disc, ROUND(@amt, 0), @partyCode, @storeCode, @mainType, @subType,
                        @type, @prefix, @narration, @branchCode, @unit, @discAmt, @mrp,
                        @newRate, @taxCode, @taxAmt, @cessAmt, @taxable, @barcodeValue,
                        @userId, @companyId, @createdBy, GETDATE(), @modifiedBy, GETDATE(),
                        @cgst, @sgst, @igst, @utgst, @pnding, @colours,
                        @s1, @q1, @s2, @q2, @s3, @q3, @s4, @q4, @s5, @q5,
                        @s6, @q6, @s7, @q7, @s8, @q8, @s9, @q9
                    )
                `);
        }

        // After successful sales insertion, add Ledger entries
        const transactionNumber = Math.floor(Math.random() * 1000000).toString().toString() // Generate random transaction number

        // 1. Insert Net Amount (Credit)
        await connection.request()
            .input('Sno', sql.VarChar, '1')
            .input('CurrName', sql.VarChar, '')
            .input('CurrRate', sql.Decimal, 0.00)
            .input('MainType', sql.VarChar, 'SL')
            .input('SubType', sql.VarChar, 'NS')
            .input('Type', sql.VarChar, 'SRT')
            .input('Srl', sql.VarChar, docNo)
            .input('DocDate', sql.DateTime, docDate)
            .input('Code', sql.VarChar, customerCode)
            .input('Debit', sql.Decimal, 0.00)
            .input('Credit', sql.Decimal, billAmt)
            .input('Cheque', sql.VarChar, '')
            .input('RecoFlag', sql.VarChar, '0')
            .input('ClearDate', sql.DateTime, docDate)
            .input('Narr', sql.VarChar, narration)
            .input('Prefix', sql.VarChar, prefix)
            .input('Branch', sql.VarChar, '')
            .input('AltCode', sql.VarChar, '777777777')
            .input('Party', sql.VarChar, customerCode)
            .input('BillNumber', sql.VarChar, billNo)
            .input('BillDate', sql.DateTime, billDate)
            .input('ChequeDate', sql.DateTime, billDate)
            .input('DraweeBranch', sql.VarChar, '')
            .input('AccountName', sql.VarChar, '')
            .input('ReferenceCode', sql.VarChar, '')
            .input('UserID', sql.Int, userId)
            .input('CompanyID', sql.Int, companyId)
            .input('CreatedBy', sql.Int, createdBy)
            .input('ModifiedBy', sql.Int, modifiedBy)
            .input('aSrl', sql.VarChar, docNo)
            .input('aMainType', sql.VarChar, 'PR')
            .input('aSubType', sql.VarChar, 'RP')
            .input('aType', sql.VarChar, 'PUR')
            .input('aPrefix', sql.VarChar, prefix)
            .input('TransactionNumber', sql.VarChar, transactionNumber)
            .query(`INSERT INTO Ledger
           ([Sno]
           ,[CurrName]
           ,[CurrRate]
           ,[MainType]
           ,[SubType]
           ,[Type]
           ,[Srl]
           ,[DocDate]
           ,[Code]
           ,[Debit]
           ,[Credit]
           ,[Cheque]
           ,[RecoFlag]
           ,[ClearDate]
           ,[Narr]
           ,[Prefix]
           ,[Branch]
           ,[AltCode]
           ,[Party]
           ,[BillNumber]
           ,[BillDate]
           ,[ChequeDate]
           ,[DraweeBranch]
           ,[AccountName]
           ,[ReferenceCode]
           ,[UserID]
           ,[CompanyID]
           ,[CreatedBy]
           ,[CreatedDate]
           ,[ModifiedBy]
           ,[ModifiedDate]
           ,[aSRL]
           ,[aMainType]
           ,[aSubType]
           ,[aType]
           ,[aPrefix]
           ,TransactionNumber)
     VALUES
           (@Sno
           ,@CurrName
           ,@CurrRate 
           ,@MainType
           ,@SubType
           ,@Type
           ,@Srl
           ,@DocDate
           ,@Code
           ,@Debit
           ,@Credit
           ,@Cheque
           ,@RecoFlag
           ,@ClearDate
           ,@Narr
           ,@Prefix
           ,@Branch
           ,@AltCode
           ,@Party
           ,@BillNumber
           ,@BillDate
           ,@ChequeDate
           ,@DraweeBranch
           ,@AccountName
           ,@ReferenceCode
           ,@UserID
           ,@CompanyID
           ,@CreatedBy
           ,GETDATE()
           ,@ModifiedBy
           ,GETDATE()
           ,@aSrl
           ,@aMainType
           ,@aSubType
           ,@aType
           ,@aPrefix
           ,@TransactionNumber)`);

        // 2. Insert Discount Amount (Debit)
        if (netAmt > 0) {
            await connection.request()
                .input('Sno', sql.VarChar, '2')
                .input('CurrName', sql.VarChar, '')
                .input('CurrRate', sql.Decimal, 0.00)
                .input('MainType', sql.VarChar, 'SL')
                .input('SubType', sql.VarChar, 'NS')
                .input('Type', sql.VarChar, 'SRT')
                .input('Srl', sql.VarChar, docNo)
                .input('DocDate', sql.DateTime, docDate)
                .input('Code', sql.VarChar, '777777777')
                .input('Debit', sql.Decimal, netAmt)
                .input('Credit', sql.Decimal, 0.00)
                .input('Cheque', sql.VarChar, '')
                .input('RecoFlag', sql.VarChar, '0')
                .input('ClearDate', sql.DateTime, docDate)
                .input('Narr', sql.VarChar, narration)
                .input('Prefix', sql.VarChar, prefix)
                .input('Branch', sql.VarChar, '')
                .input('AltCode', sql.VarChar, customerCode)
                .input('Party', sql.VarChar, customerCode)
                .input('BillNumber', sql.VarChar, billNo)
                .input('BillDate', sql.DateTime, billDate)
                .input('ChequeDate', sql.DateTime, billDate)
                .input('DraweeBranch', sql.VarChar, '')
                .input('AccountName', sql.VarChar, '')
                .input('ReferenceCode', sql.VarChar, '')
                .input('UserID', sql.Int, userId)
                .input('CompanyID', sql.Int, companyId)
                .input('CreatedBy', sql.Int, createdBy)
                .input('ModifiedBy', sql.Int, modifiedBy)
                .input('aSrl', sql.VarChar, docNo)
                .input('aMainType', sql.VarChar, 'PR')
                .input('aSubType', sql.VarChar, 'RP')
                .input('aType', sql.VarChar, 'PUR')
                .input('aPrefix', sql.VarChar, prefix)
                .input('TransactionNumber', sql.VarChar, transactionNumber)
                .query(`INSERT INTO Ledger
           ([Sno]
           ,[CurrName]
           ,[CurrRate]
           ,[MainType]
           ,[SubType]
           ,[Type]
           ,[Srl]
           ,[DocDate]
           ,[Code]
           ,[Debit]
           ,[Credit]
           ,[Cheque]
           ,[RecoFlag]
           ,[ClearDate]
           ,[Narr]
           ,[Prefix]
           ,[Branch]
           ,[AltCode]
           ,[Party]
           ,[BillNumber]
           ,[BillDate]
           ,[ChequeDate]
           ,[DraweeBranch]
           ,[AccountName]
           ,[ReferenceCode]
           ,[UserID]
           ,[CompanyID]
           ,[CreatedBy]
           ,[CreatedDate]
           ,[ModifiedBy]
           ,[ModifiedDate]
           ,[aSRL]
           ,[aMainType]
           ,[aSubType]
           ,[aType]
           ,[aPrefix]
           ,TransactionNumber)
     VALUES
           (@Sno
           ,@CurrName
           ,@CurrRate 
           ,@MainType
           ,@SubType
           ,@Type
           ,@Srl
           ,@DocDate
           ,@Code
           ,@Debit
           ,@Credit
           ,@Cheque
           ,@RecoFlag
           ,@ClearDate
           ,@Narr
           ,@Prefix
           ,@Branch
           ,@AltCode
           ,@Party
           ,@BillNumber
           ,@BillDate
           ,@ChequeDate
           ,@DraweeBranch
           ,@AccountName
           ,@ReferenceCode
           ,@UserID
           ,@CompanyID
           ,@CreatedBy
           ,GETDATE()
           ,@ModifiedBy
           ,GETDATE()
           ,@aSrl
           ,@aMainType
           ,@aSubType
           ,@aType
           ,@aPrefix
           ,@TransactionNumber)`);
        }

        // 3. Insert CGST Amount (Debit)
        if (cgst > 0) {
            await connection.request()
                .input('Sno', sql.VarChar, '3')
                .input('CurrName', sql.VarChar, '')
                .input('CurrRate', sql.Decimal, 0.00)
                .input('MainType', sql.VarChar, 'SL')
                .input('SubType', sql.VarChar, 'NS')
                .input('Type', sql.VarChar, 'SRT')
                .input('Srl', sql.VarChar, docNo)
                .input('DocDate', sql.DateTime, docDate)
                .input('Code', sql.VarChar, '999999999')
                .input('Debit', sql.Decimal, cgst)
                .input('Credit', sql.Decimal, 0.00)
                .input('Cheque', sql.VarChar, '')
                .input('RecoFlag', sql.VarChar, '0')
                .input('ClearDate', sql.DateTime, docDate)
                .input('Narr', sql.VarChar, narration)
                .input('Prefix', sql.VarChar, prefix)
                .input('Branch', sql.VarChar, '')
                .input('AltCode', sql.VarChar, customerCode)
                .input('Party', sql.VarChar, customerCode)
                .input('BillNumber', sql.VarChar, billNo)
                .input('BillDate', sql.DateTime, billDate)
                .input('ChequeDate', sql.DateTime, billDate)
                .input('DraweeBranch', sql.VarChar, '')
                .input('AccountName', sql.VarChar, '')
                .input('ReferenceCode', sql.VarChar, '')
                .input('UserID', sql.Int, userId)
                .input('CompanyID', sql.Int, companyId)
                .input('CreatedBy', sql.Int, createdBy)
                .input('ModifiedBy', sql.Int, modifiedBy)
                .input('aSrl', sql.VarChar, docNo)
                .input('aMainType', sql.VarChar, 'PR')
                .input('aSubType', sql.VarChar, 'RP')
                .input('aType', sql.VarChar, 'PUR')
                .input('aPrefix', sql.VarChar, prefix)
                .input('TransactionNumber', sql.VarChar, transactionNumber)
                .query(`INSERT INTO Ledger
           ([Sno]
           ,[CurrName]
           ,[CurrRate]
           ,[MainType]
           ,[SubType]
           ,[Type]
           ,[Srl]
           ,[DocDate]
           ,[Code]
           ,[Debit]
           ,[Credit]
           ,[Cheque]
           ,[RecoFlag]
           ,[ClearDate]
           ,[Narr]
           ,[Prefix]
           ,[Branch]
           ,[AltCode]
           ,[Party]
           ,[BillNumber]
           ,[BillDate]
           ,[ChequeDate]
           ,[DraweeBranch]
           ,[AccountName]
           ,[ReferenceCode]
           ,[UserID]
           ,[CompanyID]
           ,[CreatedBy]
           ,[CreatedDate]
           ,[ModifiedBy]
           ,[ModifiedDate]
           ,[aSRL]
           ,[aMainType]
           ,[aSubType]
           ,[aType]
           ,[aPrefix]
           ,TransactionNumber)
     VALUES
           (@Sno
           ,@CurrName
           ,@CurrRate 
           ,@MainType
           ,@SubType
           ,@Type
           ,@Srl
           ,@DocDate
           ,@Code
           ,@Debit
           ,@Credit
           ,@Cheque
           ,@RecoFlag
           ,@ClearDate
           ,@Narr
           ,@Prefix
           ,@Branch
           ,@AltCode
           ,@Party
           ,@BillNumber
           ,@BillDate
           ,@ChequeDate
           ,@DraweeBranch
           ,@AccountName
           ,@ReferenceCode
           ,@UserID
           ,@CompanyID
           ,@CreatedBy
           ,GETDATE()
           ,@ModifiedBy
           ,GETDATE()
           ,@aSrl
           ,@aMainType
           ,@aSubType
           ,@aType
           ,@aPrefix
           ,@TransactionNumber)`);
        }


        if (sgst > 0) {
            await connection.request()
                .input('Sno', sql.VarChar, '4')
                .input('CurrName', sql.VarChar, '')
                .input('CurrRate', sql.Decimal, 0.00)
                .input('MainType', sql.VarChar, 'SL')
                .input('SubType', sql.VarChar, 'NS')
                .input('Type', sql.VarChar, 'SRT')
                .input('Srl', sql.VarChar, docNo)
                .input('DocDate', sql.DateTime, docDate)
                .input('Code', sql.VarChar, '999999998')
                .input('Debit', sql.Decimal, sgst)
                .input('Credit', sql.Decimal, 0.00)
                .input('Cheque', sql.VarChar, '')
                .input('RecoFlag', sql.VarChar, '0')
                .input('ClearDate', sql.DateTime, docDate)
                .input('Narr', sql.VarChar, narration)
                .input('Prefix', sql.VarChar, prefix)
                .input('Branch', sql.VarChar, '')
                .input('AltCode', sql.VarChar, customerCode)
                .input('Party', sql.VarChar, customerCode)
                .input('BillNumber', sql.VarChar, billNo)
                .input('BillDate', sql.DateTime, billDate)
                .input('ChequeDate', sql.DateTime, billDate)
                .input('DraweeBranch', sql.VarChar, '')
                .input('AccountName', sql.VarChar, '')
                .input('ReferenceCode', sql.VarChar, '')
                .input('UserID', sql.Int, userId)
                .input('CompanyID', sql.Int, companyId)
                .input('CreatedBy', sql.Int, createdBy)
                .input('ModifiedBy', sql.Int, modifiedBy)
                .input('aSrl', sql.VarChar, docNo)
                .input('aMainType', sql.VarChar, 'PR')
                .input('aSubType', sql.VarChar, 'RP')
                .input('aType', sql.VarChar, 'PUR')
                .input('aPrefix', sql.VarChar, prefix)
                .input('TransactionNumber', sql.VarChar, transactionNumber)
                .query(`
                    INSERT INTO Ledger (
                        Sno, CurrName, CurrRate, MainType, SubType, Type, Srl, DocDate,
                        Code, Debit, Credit, Cheque, RecoFlag, ClearDate, Narr, Prefix,
                        Branch, AltCode, Party, BillNumber, BillDate, ChequeDate,
                        DraweeBranch, AccountName, ReferenceCode, UserID, CompanyID,
                        CreatedBy, CreatedDate, ModifiedBy, ModifiedDate, aSRL,
                        aMainType, aSubType, aType, aPrefix, TransactionNumber
                    )
                    VALUES (
                        @Sno, @CurrName, @CurrRate, @MainType, @SubType, @Type, @Srl,
                        @DocDate, @Code, @Debit, @Credit, @Cheque, @RecoFlag, @ClearDate,
                        @Narr, @Prefix, @Branch, @AltCode, @Party, @BillNumber, @BillDate,
                        @ChequeDate, @DraweeBranch, @AccountName, @ReferenceCode, @UserID,
                        @CompanyID, @CreatedBy, GETDATE(), @ModifiedBy, GETDATE(), @aSrl,
                        @aMainType, @aSubType, @aType, @aPrefix, @TransactionNumber
                    )`);
        }

        // Insert into Outstanding table
        const outstandingQuery = `
            INSERT INTO Outstanding (
                Branch, MainType, SubType, Type, Prefix, Srl, Sno,
                aMainType, aSubType, aType, aPrefix, aSerial, aSno,
                CurrName, CurrRate, DocDate, Code, Amount, Pending,
                Flag, BillNumber, BillDate, CrPeriod, TdsAmt,
                OpnPending, OrdNumber, OrdDate, OpFlag, RefParty,
                Remark, ncode, AdvanceWithGST, UserID, CompanyID,
                TransactionNumber, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
            )
            VALUES (
                @Branch, @MainType, @SubType, @Type, @Prefix, @Srl, @Sno,
                @aMainType, @aSubType, @aType, @aPrefix, @aSerial, @aSno,
                @CurrName, @CurrRate, @DocDate, @Code, ROUND(@Amount, 0), ROUND(@Pending, 0),
                @Flag, @BillNumber, @BillDate, @CrPeriod, @TdsAmt,
                @OpnPending, @OrdNumber, @OrdDate, @OpFlag, @RefParty,
                @Remark, @ncode, @AdvanceWithGST, @UserID, @CompanyID,
                @TransactionNumber, @CreatedBy, GETDATE(), @ModifiedBy, GETDATE()
            )`;

        await connection.request()
            .input('Branch', sql.VarChar(6), '')
            .input('MainType', sql.VarChar(2), 'SL')
            .input('SubType', sql.VarChar(2), 'NS')
            .input('Type', sql.VarChar(3), 'SRT')
            .input('Prefix', sql.VarChar(8), prefix)
            .input('Srl', sql.VarChar(35), docNo)
            .input('Sno', sql.VarChar(5), '00001')
            .input('aMainType', sql.VarChar(2), 'SL')
            .input('aSubType', sql.VarChar(2), 'NS')
            .input('aType', sql.VarChar(3), 'SRT')
            .input('aPrefix', sql.VarChar(8), prefix)
            .input('aSerial', sql.VarChar(35), docNo)
            .input('aSno', sql.VarChar(5), '00001')
            .input('CurrName', sql.VarChar(10), '')
            .input('CurrRate', sql.Money, 0)
            .input('DocDate', sql.DateTime, docDate)
            .input('Code', sql.VarChar(30), customerCode)
            .input('Amount', sql.Money, billAmt)
            .input('Pending', sql.Money, billAmt)
            .input('Flag', sql.VarChar(1), 'D')
            .input('BillNumber', sql.VarChar(255), billNo)
            .input('BillDate', sql.DateTime, billDate)
            .input('CrPeriod', sql.Int, 0)
            .input('TdsAmt', sql.Money, 0)
            .input('OpnPending', sql.Money, 0)
            .input('OrdNumber', sql.VarChar(255), '')
            .input('OrdDate', sql.DateTime, null)
            .input('OpFlag', sql.VarChar(1), '')
            .input('RefParty', sql.VarChar(9), '')
            .input('Remark', sql.VarChar(500), '')
            .input('ncode', sql.VarChar(50), '')
            .input('AdvanceWithGST', sql.Bit, 0)
            .input('UserID', sql.Int, userId)
            .input('CompanyID', sql.Int, companyId)
            .input('TransactionNumber', sql.VarChar(50), transactionNumber)
            .input('CreatedBy', sql.Int, createdBy)
            .input('ModifiedBy', sql.Int, modifiedBy)
            .query(outstandingQuery);

        res.status(201).json({
            message: 'Invoice and Outstanding entry created successfully'
        });


        // res.status(201).json({ message: 'Invoice created successfully', salesId: salesId });
    } catch (err: any) {
        console.error('Error creating return:', err);
        res.status(500).json({ error: 'An error occurred while creating the return', details: err.message });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});


app.get('/purchase-items', async (req: Request, res: Response) => {
    let pool;
    try {
        // Get values from headers
        const userID = req.header('UserID');
        const companyID = req.header('CompanyID');
        const prefix = req.header('Prefix');

        // Validate headers
        if (!userID || !companyID || !prefix) {
            return res.status(400).json({ error: "Missing required headers: UserID, CompanyID, or Prefix" });
        }

        pool = await sql.connect(dbConfig);

        // Query for items
        const itemsRequest = pool.request();
        itemsRequest.input('UserID', sql.Int, parseInt(userID));
        itemsRequest.input('CompanyID', sql.Int, parseInt(companyID));

        const itemsQuery = `
            SELECT [ItemID], [ItemCode], [ItemName], [PurRate], [PurDisc], [SalRate], [SalDisc],
                   [Barcode], [OpeningStock], [Unit], [MRP], [TaxCode], [UserID], [CompanyID],
                   [CreatedBy], [CreatedDate], [ModifiedBy], [ModifiedDate], [GroupCode], [Flag],
                   [HSNCode], [TaxCategory], [GSTTaxCode], [IGSTTaxCode], [UTGSTTaxCode], [imgPath],
                   [Catagri], [grosswegiht], [netwegiht], [purity], [print], [makingcharge], [Othercharge]
            FROM [QuickbillBook].[dbo].[ItemMaster] 
            WHERE UserID = @UserID AND CompanyID = @CompanyID ORDER BY ItemName ASC`;

        const itemsResult = await itemsRequest.query(itemsQuery);

        // Query for last serial code
        const serialRequest = pool.request();
        serialRequest.input('UserID', sql.Int, parseInt(userID));
        serialRequest.input('CompanyID', sql.Int, parseInt(companyID));
        serialRequest.input('Prefix', sql.VarChar, prefix);

        const serialQuery = `
            Select top 1 isnull(DocNo,0) as SRL from purchase 
						where 
						MainType='PR' AND
                        SubType='RP' AND
						[Type]='PUR' 
						and Prefix=@Prefix
						and CompanyID=@CompanyID
						and UserID=@UserID
						order by DocNo desc`;



        const serialResult = await serialRequest.query(serialQuery);

        const lastSerial = serialResult.recordset[0]?.SRL || '0';
        const nextSerialNumber = parseInt(lastSerial) + 1;
        const nextSerial = nextSerialNumber.toString().padStart(6, '0');

        res.json({
            items: itemsResult.recordset,
            lastSerial: lastSerial,
            nextSerial: nextSerial
        });

    } catch (error) {
        console.error("Error while fetching items and serial", error);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        if (pool) {
            await pool.close();
        }
    }
});

app.post('/api/create-purchase', async (req: Request, res: Response) => {
    let connection;
    try {
        connection = await sql.connect(dbConfig);
        const {
            customerCode, docNo, docDate, billNo, billDate, partyCode, billAmt, totalQty, netAmt, taxAmt, discAmt,
            mainType, subType, type, prefix, narration, userId, companyId, createdBy, modifiedBy,
            partyName, selection, productName, discPer, cgst, sgst, igst, utgst, rate, totalAmt,
            status, addCode, roundoff, extrCharch, discountExtra, exchargelager, exDicoutlager,
            items
        } = req.body;

        // Insert into Purchase table
        const purchaseResult = await connection.request()
            .input('docNo', sql.VarChar, docNo)
            .input('docDate', sql.DateTime, docDate)
            .input('billNo', sql.VarChar, billNo)
            .input('billDate', sql.DateTime, billDate)
            .input('partyCode', sql.VarChar, partyCode)
            .input('billAmt', sql.Decimal, billAmt)
            .input('totalQty', sql.Decimal, totalQty)
            .input('netAmt', sql.Decimal, netAmt)
            .input('taxAmt', sql.Decimal, taxAmt)
            .input('discAmt', sql.Decimal, discAmt)
            .input('mainType', sql.VarChar, mainType)
            .input('subType', sql.VarChar, subType)
            .input('type', sql.VarChar, type)
            .input('prefix', sql.VarChar, prefix)
            .input('narration', sql.VarChar, narration)
            .input('userId', sql.Int, userId)
            .input('companyId', sql.Int, companyId)
            .input('createdBy', sql.Int, createdBy)
            .input('modifiedBy', sql.Int, modifiedBy)
            .input('partyName', sql.VarChar, partyName)
            .input('selection', sql.VarChar, selection)
            .input('productName', sql.VarChar, productName)
            .input('discPer', sql.Decimal, discPer)
            .input('cgst', sql.Decimal, cgst)
            .input('sgst', sql.Decimal, sgst)
            .input('igst', sql.Decimal, igst)
            .input('utgst', sql.Decimal, utgst)
            .input('rate', sql.Decimal, rate)
            .input('totalAmt', sql.Decimal, totalAmt)
            .input('status', sql.VarChar, status)
            .input('addCode', sql.VarChar, addCode)
            .input('roundoff', sql.Decimal, roundoff)
            .input('extrCharch', sql.Decimal, extrCharch)
            .input('discountExtra', sql.Decimal, discountExtra)
            .input('exchargelager', sql.VarChar, exchargelager)
            .input('exDicoutlager', sql.VarChar, exDicoutlager)
            .query(`
                INSERT INTO [Purchase] (
                    DocNo, DocDate, BillNo, BillDate, PartyCode, BillAmt, TotalQty, NetAmt, TaxAmt,
                    DiscAmt, MainType, SubType, Type, Prefix, Narration, UserID, CompanyID, CreatedBy,
                    CreatedDate, ModifiedBy, ModifiedDate, PartyName, Selection, ProductName, DiscPer,
                    CGST, SGST, IGST, UTGST, Rate, TotalAmt, Status, AddCode, Roundoff, ExtrCharch,
                    DiscountExtra, Exchargelager, ExDicoutlager
                )
                OUTPUT INSERTED.PurchaseID
                VALUES (
                    @docNo, @docDate, @billNo, @billDate, @partyCode, @billAmt, @totalQty, @netAmt,
                    @taxAmt, @discAmt, @mainType, @subType, @type, @prefix, @narration, @userId,
                    @companyId, @createdBy, GETDATE(), @modifiedBy, GETDATE(), @partyName, @selection,
                    @productName, @discPer, @cgst, @sgst, @igst, @utgst, @rate, ROUND(@totalAmt, 0),
                    @status, @addCode, @roundoff, @extrCharch, @discountExtra, @exchargelager,
                    @exDicoutlager
                )
            `);

        if (!purchaseResult.recordset || purchaseResult.recordset.length === 0) {
            throw new Error('Failed to insert purchase: No PurchaseID returned');
        }

        const purchaseId = purchaseResult.recordset[0].PurchaseID;

        // Insert items into Stock table
        for (const item of items) {
            await connection.request()
                .input('srl', sql.VarChar, item.srl)
                .input('sNo', sql.VarChar, item.sNo)
                .input('currName', sql.VarChar, item.currName)
                .input('currRate', sql.Decimal, item.currRate)
                .input('docDate', sql.DateTime, item.docDate)
                .input('itemCode', sql.VarChar, item.itemCode)
                .input('qty', sql.Decimal, item.qty)
                .input('rate', sql.Decimal, item.rate)
                .input('disc', sql.Decimal, item.disc)
                .input('amt', sql.Decimal, item.amt)
                .input('partyCode', sql.VarChar, item.partyCode)
                .input('storeCode', sql.VarChar, item.storeCode)
                .input('mainType', sql.VarChar, item.mainType)
                .input('subType', sql.VarChar, item.subType)
                .input('type', sql.VarChar, item.type)
                .input('prefix', sql.VarChar, item.prefix)
                .input('narration', sql.VarChar, item.narration)
                .input('branchCode', sql.VarChar, item.branchCode)
                .input('unit', sql.VarChar, item.unit)
                .input('discAmt', sql.Decimal, item.discAmt)
                .input('mrp', sql.Decimal, item.mrp)
                .input('newRate', sql.Decimal, item.newRate)
                .input('taxCode', sql.VarChar, item.taxCode)
                .input('taxAmt', sql.Decimal, item.taxAmt)
                .input('cessAmt', sql.Decimal, item.cessAmt)
                .input('taxable', sql.Decimal, item.taxable)
                .input('barcodeValue', sql.VarChar, item.barcodeValue)
                .input('userId', sql.Int, item.userId)
                .input('companyId', sql.Int, item.companyId)
                .input('createdBy', sql.Int, item.createdBy)
                .input('modifiedBy', sql.Int, item.modifiedBy)
                .input('cgst', sql.Decimal, item.cgst)
                .input('sgst', sql.Decimal, item.sgst)
                .input('igst', sql.Decimal, item.igst)
                .input('utgst', sql.Decimal, item.utgst)
                .input('pnding', sql.Decimal, item.pnding)
                .input('colours', sql.VarChar, item.colours)
                .input('s1', sql.VarChar, item.s1)
                .input('q1', sql.Decimal, item.q1)
                .input('s2', sql.VarChar, item.s2)
                .input('q2', sql.Decimal, item.q2)
                .input('s3', sql.VarChar, item.s3)
                .input('q3', sql.Decimal, item.q3)
                .input('s4', sql.VarChar, item.s4)
                .input('q4', sql.Decimal, item.q4)
                .input('s5', sql.VarChar, item.s5)
                .input('q5', sql.Decimal, item.q5)
                .input('s6', sql.VarChar, item.s6)
                .input('q6', sql.Decimal, item.q6)
                .input('s7', sql.VarChar, item.s7)
                .input('q7', sql.Decimal, item.q7)
                .input('s8', sql.VarChar, item.s8)
                .input('q8', sql.Decimal, item.q8)
                .input('s9', sql.VarChar, item.s9)
                .input('q9', sql.Decimal, item.q9)
                .query(`
                    INSERT INTO Stock (
                        SRL, SNo, CurrName, CurrRate, DocDate, ItemCode, Qty, Rate, Disc, Amt,
                        PartyCode, StoreCode, MainType, SubType, Type, Prefix, Narration,
                        BranchCode, Unit, DiscAmt, MRP, NewRate, TaxCode, TaxAmt, CessAmt,
                        Taxable, BarcodeValue, UserID, CompanyID, CreatedBy, CreatedDate,
                        ModifiedBy, ModifiedDate, CGST, SGST, IGST, UTGST, Pnding,
                        Colours, S1, Q1, S2, Q2, S3, Q3, S4, Q4, S5, Q5, S6, Q6, S7, Q7, S8, Q8, S9, Q9
                    )
                    VALUES (
                        @srl, @sNo, @currName, @currRate, @docDate, @itemCode, @qty, @rate,
                        @disc, ROUND(@amt, 0), @partyCode, @storeCode, @mainType, @subType,
                        @type, @prefix, @narration, @branchCode, @unit, @discAmt, @mrp,
                        @newRate, @taxCode, @taxAmt, @cessAmt, @taxable, @barcodeValue,
                        @userId, @companyId, @createdBy, GETDATE(), @modifiedBy, GETDATE(),
                        @cgst, @sgst, @igst, @utgst, @pnding, @colours,
                        @s1, @q1, @s2, @q2, @s3, @q3, @s4, @q4, @s5, @q5,
                        @s6, @q6, @s7, @q7, @s8, @q8, @s9, @q9
                    )
                `);
        }



        // Generate transaction number
        const transactionNumber = Math.floor(Math.random() * 1000000).toString();

        // 1. Insert Net Amount (Credit)
        await connection.request()
            .input('Sno', sql.VarChar(5), '1')
            .input('CurrName', sql.VarChar(10), '')
            .input('CurrRate', sql.Money, 0.00)
            .input('MainType', sql.VarChar(2), 'PR')
            .input('SubType', sql.VarChar(2), 'RP')
            .input('Type', sql.VarChar(3), 'PUR')
            .input('Srl', sql.VarChar(35), docNo)
            .input('DocDate', sql.DateTime, new Date(docDate))
            .input('Code', sql.VarChar(9), customerCode)
            .input('Debit', sql.Money, 0.00)
            .input('Credit', sql.Money, billAmt)
            .input('Cheque', sql.VarChar(20), '')
            .input('RecoFlag', sql.VarChar(1), '')
            .input('ClearDate', sql.DateTime, new Date(docDate))
            .input('Narr', sql.Text, narration || '')
            .input('Prefix', sql.VarChar(8), prefix)
            .input('Branch', sql.VarChar(6), '')
            .input('AltCode', sql.VarChar(9), customerCode)
            .input('Party', sql.VarChar(9), partyCode)
            .input('BillNumber', sql.VarChar(255), billNo)
            .input('BillDate', sql.DateTime, new Date(billDate))
            .input('ChequeDate', sql.DateTime, new Date(billDate))
            .input('DraweeBranch', sql.VarChar(150), '')
            .input('AccountName', sql.VarChar(100), '')
            .input('ReferenceCode', sql.VarChar(50), '')
            .input('UserID', sql.Int, userId)
            .input('CompanyID', sql.Int, companyId)
            .input('CreatedBy', sql.Int, createdBy)
            .input('ModifiedBy', sql.Int, modifiedBy)
            .input('aSRL', sql.VarChar(35), docNo)
            .input('aMainType', sql.VarChar(2), 'PR')
            .input('aSubType', sql.VarChar(2), 'RP')
            .input('aType', sql.VarChar(3), 'PUR')
            .input('aPrefix', sql.VarChar(8), prefix)
            .input('TransactionNumber', sql.VarChar(50), transactionNumber)
            .query(`
                INSERT INTO Ledger
                ([Sno]
                ,[CurrName]
                ,[CurrRate]
                ,[MainType]
                ,[SubType]
                ,[Type]
                ,[Srl]
                ,[DocDate]
                ,[Code]
                ,[Debit]
                ,[Credit]
                ,[Cheque]
                ,[RecoFlag]
                ,[ClearDate]
                ,[Narr]
                ,[Prefix]
                ,[Branch]
                ,[AltCode]
                ,[Party]
                ,[BillNumber]
                ,[BillDate]
                ,[ChequeDate]
                ,[DraweeBranch]
                ,[AccountName]
                ,[ReferenceCode]
                ,[UserID]
                ,[CompanyID]
                ,[CreatedBy]
                ,[CreatedDate]
                ,[ModifiedBy]
                ,[ModifiedDate]
                ,[aSRL]
                ,[aMainType]
                ,[aSubType]
                ,[aType]
                ,[aPrefix]
                ,TransactionNumber)
                VALUES
                (@Sno
                ,@CurrName
                ,@CurrRate 
                ,@MainType
                ,@SubType
                ,@Type
                ,@Srl
                ,@DocDate
                ,@Code
                ,@Debit
                ,@Credit
                ,@Cheque
                ,@RecoFlag
                ,@ClearDate
                ,@Narr
                ,@Prefix
                ,@Branch
                ,@AltCode
                ,@Party
                ,@BillNumber
                ,@BillDate
                ,@ChequeDate
                ,@DraweeBranch
                ,@AccountName
                ,@ReferenceCode
                ,@UserID
                ,@CompanyID
                ,@CreatedBy
                ,GETDATE()
                ,@ModifiedBy
                ,GETDATE()
                ,@aSrl
                ,@aMainType
                ,@aSubType
                ,@aType
                ,@aPrefix
                ,@TransactionNumber)`);

        // 2. Insert Discount Amount (Debit)
        if (netAmt > 0) {
            await connection.request()
                .input('Sno', sql.VarChar(5), '2')
                .input('CurrName', sql.VarChar(10), '')
                .input('CurrRate', sql.Money, 0.00)
                .input('MainType', sql.VarChar(2), 'PR')
                .input('SubType', sql.VarChar(2), 'RP')
                .input('Type', sql.VarChar(3), 'PUR')
                .input('Srl', sql.VarChar(35), docNo)
                .input('DocDate', sql.DateTime, new Date(docDate))
                .input('Code', sql.VarChar(9), '888888888')
                .input('Debit', sql.Money, netAmt)
                .input('Credit', sql.Money, 0.00)
                .input('Cheque', sql.VarChar(20), '')
                .input('RecoFlag', sql.VarChar(1), '')
                .input('ClearDate', sql.DateTime, new Date(docDate))
                .input('Narr', sql.Text, narration || '')
                .input('Prefix', sql.VarChar(8), prefix)
                .input('Branch', sql.VarChar(6), '')
                .input('AltCode', sql.VarChar(9), customerCode)
                .input('Party', sql.VarChar(9), partyCode)
                .input('BillNumber', sql.VarChar(255), billNo)
                .input('BillDate', sql.DateTime, new Date(billDate))
                .input('ChequeDate', sql.DateTime, new Date(billDate))
                .input('DraweeBranch', sql.VarChar(150), '')
                .input('AccountName', sql.VarChar(100), '')
                .input('ReferenceCode', sql.VarChar(50), '')
                .input('UserID', sql.Int, userId)
                .input('CompanyID', sql.Int, companyId)
                .input('CreatedBy', sql.Int, createdBy)
                .input('ModifiedBy', sql.Int, modifiedBy)
                .input('aSRL', sql.VarChar(35), docNo)
                .input('aMainType', sql.VarChar(2), 'PR')
                .input('aSubType', sql.VarChar(2), 'RP')
                .input('aType', sql.VarChar(3), 'PUR')
                .input('aPrefix', sql.VarChar(8), prefix)
                .input('TransactionNumber', sql.VarChar(50), transactionNumber)
                .query(`INSERT INTO Ledger
           ([Sno]
           ,[CurrName]
           ,[CurrRate]
           ,[MainType]
           ,[SubType]
           ,[Type]
           ,[Srl]
           ,[DocDate]
           ,[Code]
           ,[Debit]
           ,[Credit]
           ,[Cheque]
           ,[RecoFlag]
           ,[ClearDate]
           ,[Narr]
           ,[Prefix]
           ,[Branch]
           ,[AltCode]
           ,[Party]
           ,[BillNumber]
           ,[BillDate]
           ,[ChequeDate]
           ,[DraweeBranch]
           ,[AccountName]
           ,[ReferenceCode]
           ,[UserID]
           ,[CompanyID]
           ,[CreatedBy]
           ,[CreatedDate]
           ,[ModifiedBy]
           ,[ModifiedDate]
           ,[aSRL]
           ,[aMainType]
           ,[aSubType]
           ,[aType]
           ,[aPrefix]
           ,TransactionNumber)
     VALUES
           (@Sno
           ,@CurrName
           ,@CurrRate 
           ,@MainType
           ,@SubType
           ,@Type
           ,@Srl
           ,@DocDate
           ,@Code
           ,@Debit
           ,@Credit
           ,@Cheque
           ,@RecoFlag
           ,@ClearDate
           ,@Narr
           ,@Prefix
           ,@Branch
           ,@AltCode
           ,@Party
           ,@BillNumber
           ,@BillDate
           ,@ChequeDate
           ,@DraweeBranch
           ,@AccountName
           ,@ReferenceCode
           ,@UserID
           ,@CompanyID
           ,@CreatedBy
           ,GETDATE()
           ,@ModifiedBy
           ,GETDATE()
           ,@aSrl
           ,@aMainType
           ,@aSubType
           ,@aType
           ,@aPrefix
           ,@TransactionNumber)`);
        }

        // 3. Insert CGST Amount (Debit)
        if (cgst > 0) {
            await connection.request()
                .input('Sno', sql.VarChar(5), '3')
                .input('CurrName', sql.VarChar(10), '')
                .input('CurrRate', sql.Money, 0.00)
                .input('MainType', sql.VarChar(2), 'PR')
                .input('SubType', sql.VarChar(2), 'RP')
                .input('Type', sql.VarChar(3), 'PUR')
                .input('Srl', sql.VarChar(35), docNo)
                .input('DocDate', sql.DateTime, new Date(docDate))
                .input('Code', sql.VarChar(9), '888888884')
                .input('Debit', sql.Money, 0.00)
                .input('Credit', sql.Money, cgst)
                .input('Cheque', sql.VarChar(20), '')
                .input('RecoFlag', sql.VarChar(1), '')
                .input('ClearDate', sql.DateTime, new Date(docDate))
                .input('Narr', sql.Text, narration || '')
                .input('Prefix', sql.VarChar(8), prefix)
                .input('Branch', sql.VarChar(6), '')
                .input('AltCode', sql.VarChar(9), customerCode)
                .input('Party', sql.VarChar(9), partyCode)
                .input('BillNumber', sql.VarChar(255), billNo)
                .input('BillDate', sql.DateTime, new Date(billDate))
                .input('ChequeDate', sql.DateTime, new Date(billDate))
                .input('DraweeBranch', sql.VarChar(150), '')
                .input('AccountName', sql.VarChar(100), '')
                .input('ReferenceCode', sql.VarChar(50), '')
                .input('UserID', sql.Int, userId)
                .input('CompanyID', sql.Int, companyId)
                .input('CreatedBy', sql.Int, createdBy)
                .input('ModifiedBy', sql.Int, modifiedBy)
                .input('aSRL', sql.VarChar(35), docNo)
                .input('aMainType', sql.VarChar(2), 'PR')
                .input('aSubType', sql.VarChar(2), 'RP')
                .input('aType', sql.VarChar(3), 'PUR')
                .input('aPrefix', sql.VarChar(8), prefix)
                .input('TransactionNumber', sql.VarChar(50), transactionNumber)
                .query(`INSERT INTO Ledger
           ([Sno]
           ,[CurrName]
           ,[CurrRate]
           ,[MainType]
           ,[SubType]
           ,[Type]
           ,[Srl]
           ,[DocDate]
           ,[Code]
           ,[Debit]
           ,[Credit]
           ,[Cheque]
           ,[RecoFlag]
           ,[ClearDate]
           ,[Narr]
           ,[Prefix]
           ,[Branch]
           ,[AltCode]
           ,[Party]
           ,[BillNumber]
           ,[BillDate]
           ,[ChequeDate]
           ,[DraweeBranch]
           ,[AccountName]
           ,[ReferenceCode]
           ,[UserID]
           ,[CompanyID]
           ,[CreatedBy]
           ,[CreatedDate]
           ,[ModifiedBy]
           ,[ModifiedDate]
           ,[aSRL]
           ,[aMainType]
           ,[aSubType]
           ,[aType]
           ,[aPrefix]
           ,TransactionNumber)
     VALUES
           (@Sno
           ,@CurrName
           ,@CurrRate 
           ,@MainType
           ,@SubType
           ,@Type
           ,@Srl
           ,@DocDate
           ,@Code
           ,@Debit
           ,@Credit
           ,@Cheque
           ,@RecoFlag
           ,@ClearDate
           ,@Narr
           ,@Prefix
           ,@Branch
           ,@AltCode
           ,@Party
           ,@BillNumber
           ,@BillDate
           ,@ChequeDate
           ,@DraweeBranch
           ,@AccountName
           ,@ReferenceCode
           ,@UserID
           ,@CompanyID
           ,@CreatedBy
           ,GETDATE()
           ,@ModifiedBy
           ,GETDATE()
           ,@aSrl
           ,@aMainType
           ,@aSubType
           ,@aType
           ,@aPrefix
           ,@TransactionNumber)`);
        }

        // 4. Insert SGST Amount (Debit)
        if (sgst > 0) {
            await connection.request()
                .input('Sno', sql.VarChar(5), '4')
                .input('CurrName', sql.VarChar(10), '')
                .input('CurrRate', sql.Money, 0.00)
                .input('MainType', sql.VarChar(2), 'PR')
                .input('SubType', sql.VarChar(2), 'RP')
                .input('Type', sql.VarChar(3), 'PUR')
                .input('Srl', sql.VarChar(35), docNo)
                .input('DocDate', sql.DateTime, new Date(docDate))
                .input('Code', sql.VarChar(9), '888888885')
                .input('Debit', sql.Money, sgst)
                .input('Credit', sql.Money, 0.00)
                .input('Cheque', sql.VarChar(20), '')
                .input('RecoFlag', sql.VarChar(1), '')
                .input('ClearDate', sql.DateTime, new Date(docDate))
                .input('Narr', sql.Text, narration || '')
                .input('Prefix', sql.VarChar(8), prefix)
                .input('Branch', sql.VarChar(6), '')
                .input('AltCode', sql.VarChar(9), customerCode)
                .input('Party', sql.VarChar(9), partyCode)
                .input('BillNumber', sql.VarChar(255), billNo)
                .input('BillDate', sql.DateTime, new Date(billDate))
                .input('ChequeDate', sql.DateTime, new Date(billDate))
                .input('DraweeBranch', sql.VarChar(150), '')
                .input('AccountName', sql.VarChar(100), '')
                .input('ReferenceCode', sql.VarChar(50), '')
                .input('UserID', sql.Int, userId)
                .input('CompanyID', sql.Int, companyId)
                .input('CreatedBy', sql.Int, createdBy)
                .input('ModifiedBy', sql.Int, modifiedBy)
                .input('aSRL', sql.VarChar(35), docNo)
                .input('aMainType', sql.VarChar(2), 'PR')
                .input('aSubType', sql.VarChar(2), 'RP')
                .input('aType', sql.VarChar(3), 'PUR')
                .input('aPrefix', sql.VarChar(8), prefix)
                .input('TransactionNumber', sql.VarChar(50), transactionNumber)
                .query(`INSERT INTO Ledger
           ([Sno]
           ,[CurrName]
           ,[CurrRate]
           ,[MainType]
           ,[SubType]
           ,[Type]
           ,[Srl]
           ,[DocDate]
           ,[Code]
           ,[Debit]
           ,[Credit]
           ,[Cheque]
           ,[RecoFlag]
           ,[ClearDate]
           ,[Narr]
           ,[Prefix]
           ,[Branch]
           ,[AltCode]
           ,[Party]
           ,[BillNumber]
           ,[BillDate]
           ,[ChequeDate]
           ,[DraweeBranch]
           ,[AccountName]
           ,[ReferenceCode]
           ,[UserID]
           ,[CompanyID]
           ,[CreatedBy]
           ,[CreatedDate]
           ,[ModifiedBy]
           ,[ModifiedDate]
           ,[aSRL]
           ,[aMainType]
           ,[aSubType]
           ,[aType]
           ,[aPrefix]
           ,TransactionNumber)
     VALUES
           (@Sno
           ,@CurrName
           ,@CurrRate 
           ,@MainType
           ,@SubType
           ,@Type
           ,@Srl
           ,@DocDate
           ,@Code
           ,@Debit
           ,@Credit
           ,@Cheque
           ,@RecoFlag
           ,@ClearDate
           ,@Narr
           ,@Prefix
           ,@Branch
           ,@AltCode
           ,@Party
           ,@BillNumber
           ,@BillDate
           ,@ChequeDate
           ,@DraweeBranch
           ,@AccountName
           ,@ReferenceCode
           ,@UserID
           ,@CompanyID
           ,@CreatedBy
           ,GETDATE()
           ,@ModifiedBy
           ,GETDATE()
           ,@aSrl
           ,@aMainType
           ,@aSubType
           ,@aType
           ,@aPrefix
           ,@TransactionNumber)`);
        }

        // Insert into Outstanding table
        const outstandingQuery = `
            INSERT INTO Outstanding (
                Branch, MainType, SubType, Type, Prefix, Srl, Sno,
                aMainType, aSubType, aType, aPrefix, aSerial, aSno,
                CurrName, CurrRate, DocDate, Code, Amount, Pending,
                Flag, BillNumber, BillDate, CrPeriod, TdsAmt,
                OpnPending, OrdNumber, OrdDate, OpFlag, RefParty,
                Remark, ncode, AdvanceWithGST, UserID, CompanyID,
                TransactionNumber, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
            )
            VALUES (
                @Branch, @MainType, @SubType, @Type, @Prefix, @Srl, @Sno,
                @aMainType, @aSubType, @aType, @aPrefix, @aSerial, @aSno,
                @CurrName, @CurrRate, @DocDate, @Code, ROUND(@Amount, 0), ROUND(@Pending, 0),
                @Flag, @BillNumber, @BillDate, @CrPeriod, @TdsAmt,
                @OpnPending, @OrdNumber, @OrdDate, @OpFlag, @RefParty,
                @Remark, @ncode, @AdvanceWithGST, @UserID, @CompanyID,
                @TransactionNumber, @CreatedBy, GETDATE(), @ModifiedBy, GETDATE()
            )`;

        await connection.request()
            .input('Branch', sql.VarChar(6), '')
            .input('MainType', sql.VarChar(2), 'PR')
            .input('SubType', sql.VarChar(2), 'RP')
            .input('Type', sql.VarChar(3), 'PUR')
            .input('Prefix', sql.VarChar(8), prefix)
            .input('Srl', sql.VarChar(35), docNo)
            .input('Sno', sql.VarChar(5), '00001')
            .input('aMainType', sql.VarChar(2), 'PR')
            .input('aSubType', sql.VarChar(2), 'RP')
            .input('aType', sql.VarChar(3), 'PUR')
            .input('aPrefix', sql.VarChar(8), prefix)
            .input('aSerial', sql.VarChar(35), docNo)
            .input('aSno', sql.VarChar(5), '00001')
            .input('CurrName', sql.VarChar(10), '')
            .input('CurrRate', sql.Money, 0)
            .input('DocDate', sql.DateTime, docDate)
            .input('Code', sql.VarChar(30), customerCode)
            .input('Amount', sql.Money, billAmt)
            .input('Pending', sql.Money, billAmt)
            .input('Flag', sql.VarChar(1), 'C')
            .input('BillNumber', sql.VarChar(255), billNo)
            .input('BillDate', sql.DateTime, billDate)
            .input('CrPeriod', sql.Int, 30)
            .input('TdsAmt', sql.Money, 0)
            .input('OpnPending', sql.Money, 0)
            .input('OrdNumber', sql.VarChar(255), '')
            .input('OrdDate', sql.DateTime, docDate)
            .input('OpFlag', sql.VarChar(1), '')
            .input('RefParty', sql.VarChar(9), '')
            .input('Remark', sql.VarChar(500), '')
            .input('ncode', sql.VarChar(50), '')
            .input('AdvanceWithGST', sql.Bit, 0)
            .input('UserID', sql.Int, userId)
            .input('CompanyID', sql.Int, companyId)
            .input('TransactionNumber', sql.VarChar(50), transactionNumber)
            .input('CreatedBy', sql.Int, createdBy)
            .input('ModifiedBy', sql.Int, modifiedBy)
            .query(outstandingQuery);

        res.status(201).json({
            message: 'Invoice and Outstanding entry created successfully'
        });

    } catch (err: any) {
        console.error('Error creating purchase:', err);
        res.status(500).json({ error: 'An error occurred while creating the purchase', details: err.message });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.post('/api/create-purchase-return', async (req: Request, res: Response) => {
    let connection;
    let hasResponded = false;

    try {
        connection = await sql.connect(dbConfig);
        const {
            customerCode, docNo, docDate, billNo, billDate, partyCode, billAmt, totalQty, netAmt, taxAmt, discAmt,
            mainType, subType, type, prefix, narration, userId, companyId, createdBy, modifiedBy,
            partyName, selection, productName, discPer, cgst, sgst, igst, utgst, rate, totalAmt,
            status, addCode, roundoff, extrCharch, discountExtra, exchargelager, exDicoutlager,
            items
        } = req.body;

        // Insert into Purchase table
        const purchaseResult = await connection.request()
            .input('docNo', sql.VarChar, docNo)
            .input('docDate', sql.DateTime, docDate)
            .input('billNo', sql.VarChar, billNo)
            .input('billDate', sql.DateTime, billDate)
            .input('partyCode', sql.VarChar, partyCode)
            .input('billAmt', sql.Decimal, billAmt)
            .input('totalQty', sql.Decimal, totalQty)
            .input('netAmt', sql.Decimal, netAmt)
            .input('taxAmt', sql.Decimal, taxAmt)
            .input('discAmt', sql.Decimal, discAmt)
            .input('mainType', sql.VarChar, mainType)
            .input('subType', sql.VarChar, subType)
            .input('type', sql.VarChar, type)
            .input('prefix', sql.VarChar, prefix)
            .input('narration', sql.VarChar, narration)
            .input('userId', sql.Int, userId)
            .input('companyId', sql.Int, companyId)
            .input('createdBy', sql.Int, createdBy)
            .input('modifiedBy', sql.Int, modifiedBy)
            .input('partyName', sql.VarChar, partyName)
            .input('selection', sql.VarChar, selection)
            .input('productName', sql.VarChar, productName)
            .input('discPer', sql.Decimal, discPer)
            .input('cgst', sql.Decimal, cgst)
            .input('sgst', sql.Decimal, sgst)
            .input('igst', sql.Decimal, igst)
            .input('utgst', sql.Decimal, utgst)
            .input('rate', sql.Decimal, rate)
            .input('totalAmt', sql.Decimal, totalAmt)
            .input('status', sql.VarChar, status)
            .input('addCode', sql.VarChar, addCode)
            .input('roundoff', sql.Decimal, roundoff)
            .input('extrCharch', sql.Decimal, extrCharch)
            .input('discountExtra', sql.Decimal, discountExtra)
            .input('exchargelager', sql.VarChar, exchargelager)
            .input('exDicoutlager', sql.VarChar, exDicoutlager)
            .query(`
                INSERT INTO [Purchase] (
                    DocNo, DocDate, BillNo, BillDate, PartyCode, BillAmt, TotalQty, NetAmt, TaxAmt,
                    DiscAmt, MainType, SubType, Type, Prefix, Narration, UserID, CompanyID, CreatedBy,
                    CreatedDate, ModifiedBy, ModifiedDate, PartyName, Selection, ProductName, DiscPer,
                    CGST, SGST, IGST, UTGST, Rate, TotalAmt, Status, AddCode, Roundoff, ExtrCharch,
                    DiscountExtra, Exchargelager, ExDicoutlager
                )
                OUTPUT INSERTED.PurchaseID
                VALUES (
                    @docNo, @docDate, @billNo, @billDate, @partyCode, @billAmt, @totalQty, @netAmt,
                    @taxAmt, @discAmt, @mainType, @subType, @type, @prefix, @narration, @userId,
                    @companyId, @createdBy, GETDATE(), @modifiedBy, GETDATE(), @partyName, @selection,
                    @productName, @discPer, @cgst, @sgst, @igst, @utgst, @rate, ROUND(@totalAmt, 0),
                    @status, @addCode, @roundoff, @extrCharch, @discountExtra, @exchargelager,
                    @exDicoutlager
                )
            `);

        if (!purchaseResult.recordset || purchaseResult.recordset.length === 0) {
            throw new Error('Failed to insert purchase: No PurchaseID returned');
        }

        const purchaseId = purchaseResult.recordset[0].PurchaseID;

        // Insert items into Stock table
        for (const item of items) {
            await connection.request()
                .input('srl', sql.VarChar, item.srl)
                .input('sNo', sql.VarChar, item.sNo)
                .input('currName', sql.VarChar, item.currName)
                .input('currRate', sql.Decimal, item.currRate)
                .input('docDate', sql.DateTime, item.docDate)
                .input('itemCode', sql.VarChar, item.itemCode)
                .input('qty', sql.Decimal, item.qty)
                .input('rate', sql.Decimal, item.rate)
                .input('disc', sql.Decimal, item.disc)
                .input('amt', sql.Decimal, item.amt)
                .input('partyCode', sql.VarChar, item.partyCode)
                .input('storeCode', sql.VarChar, item.storeCode)
                .input('mainType', sql.VarChar, item.mainType)
                .input('subType', sql.VarChar, item.subType)
                .input('type', sql.VarChar, item.type)
                .input('prefix', sql.VarChar, item.prefix)
                .input('narration', sql.VarChar, item.narration)
                .input('branchCode', sql.VarChar, item.branchCode)
                .input('unit', sql.VarChar, item.unit)
                .input('discAmt', sql.Decimal, item.discAmt)
                .input('mrp', sql.Decimal, item.mrp)
                .input('newRate', sql.Decimal, item.newRate)
                .input('taxCode', sql.VarChar, item.taxCode)
                .input('taxAmt', sql.Decimal, item.taxAmt)
                .input('cessAmt', sql.Decimal, item.cessAmt)
                .input('taxable', sql.Decimal, item.taxable)
                .input('barcodeValue', sql.VarChar, item.barcodeValue)
                .input('userId', sql.Int, item.userId)
                .input('companyId', sql.Int, item.companyId)
                .input('createdBy', sql.Int, item.createdBy)
                .input('modifiedBy', sql.Int, item.modifiedBy)
                .input('cgst', sql.Decimal, item.cgst)
                .input('sgst', sql.Decimal, item.sgst)
                .input('igst', sql.Decimal, item.igst)
                .input('utgst', sql.Decimal, item.utgst)
                .input('pnding', sql.Decimal, item.pnding)
                .input('colours', sql.VarChar, item.colours)
                .input('s1', sql.VarChar, item.s1)
                .input('q1', sql.Decimal, item.q1)
                .input('s2', sql.VarChar, item.s2)
                .input('q2', sql.Decimal, item.q2)
                .input('s3', sql.VarChar, item.s3)
                .input('q3', sql.Decimal, item.q3)
                .input('s4', sql.VarChar, item.s4)
                .input('q4', sql.Decimal, item.q4)
                .input('s5', sql.VarChar, item.s5)
                .input('q5', sql.Decimal, item.q5)
                .input('s6', sql.VarChar, item.s6)
                .input('q6', sql.Decimal, item.q6)
                .input('s7', sql.VarChar, item.s7)
                .input('q7', sql.Decimal, item.q7)
                .input('s8', sql.VarChar, item.s8)
                .input('q8', sql.Decimal, item.q8)
                .input('s9', sql.VarChar, item.s9)
                .input('q9', sql.Decimal, item.q9)
                .query(`
                    INSERT INTO Stock (
                        SRL, SNo, CurrName, CurrRate, DocDate, ItemCode, Qty, Rate, Disc, Amt,
                        PartyCode, StoreCode, MainType, SubType, Type, Prefix, Narration,
                        BranchCode, Unit, DiscAmt, MRP, NewRate, TaxCode, TaxAmt, CessAmt,
                        Taxable, BarcodeValue, UserID, CompanyID, CreatedBy, CreatedDate,
                        ModifiedBy, ModifiedDate, CGST, SGST, IGST, UTGST, Pnding,
                        Colours, S1, Q1, S2, Q2, S3, Q3, S4, Q4, S5, Q5, S6, Q6, S7, Q7, S8, Q8, S9, Q9
                    )
                    VALUES (
                        @srl, @sNo, @currName, @currRate, @docDate, @itemCode, @qty, @rate,
                        @disc, ROUND(@amt, 0), @partyCode, @storeCode, @mainType, @subType,
                        @type, @prefix, @narration, @branchCode, @unit, @discAmt, @mrp,
                        @newRate, @taxCode, @taxAmt, @cessAmt, @taxable, @barcodeValue,
                        @userId, @companyId, @createdBy, GETDATE(), @modifiedBy, GETDATE(),
                        @cgst, @sgst, @igst, @utgst, @pnding, @colours,
                        @s1, @q1, @s2, @q2, @s3, @q3, @s4, @q4, @s5, @q5,
                        @s6, @q6, @s7, @q7, @s8, @q8, @s9, @q9
                    )
                `);
        }

        res.status(201).json({ message: 'Purchase created successfully', purchaseId: purchaseId });

        // Generate transaction number as string
        const transactionNumber = Math.floor(Math.random() * 1000000).toString();

        console.log('Debug - Transaction Number:', transactionNumber); // Debug log

        // 1. Insert Net Amount (Debit)
        await connection.request()
            .input('Sno', sql.VarChar(5), '1')               // varchar(5)
            .input('CurrName', sql.VarChar(10), '')            // varchar(10)
            .input('CurrRate', sql.Money, 0.00)                   // money
            .input('MainType', sql.VarChar(2), 'PR')          // varchar(2)
            .input('SubType', sql.VarChar(2), 'NP')           // varchar(2)
            .input('Type', sql.VarChar(3), 'PRT')             // varchar(3)
            .input('Srl', sql.VarChar(35), docNo)             // varchar(35)
            .input('DocDate', sql.DateTime, new Date(docDate))
            .input('Code', sql.VarChar(9), customerCode)       // varchar(9)
            .input('Debit', sql.Money, billAmt)                // money
            .input('Credit', sql.Money, 0)                    // money
            .input('Cheque', sql.VarChar(20), '')             // varchar(20)
            .input('RecoFlag', sql.VarChar(1), '')            // varchar(1)
            .input('ClearDate', sql.DateTime, new Date(docDate))
            .input('Narr', sql.Text, narration || '')         // text
            .input('Prefix', sql.VarChar(8), prefix)          // varchar(8)
            .input('Branch', sql.VarChar(6), '')              // varchar(6)
            .input('AltCode', sql.VarChar(9), '')             // varchar(9)
            .input('Party', sql.VarChar(9), partyCode)        // varchar(9)
            .input('BillNumber', sql.VarChar(255), billNo)    // varchar(255)
            .input('BillDate', sql.DateTime, new Date(billDate))
            .input('ChequeDate', sql.DateTime, new Date(billDate))
            .input('DraweeBranch', sql.VarChar(150), '')      // varchar(150)
            .input('AccountName', sql.VarChar(100), '')       // varchar(100)
            .input('ReferenceCode', sql.VarChar(50), '')      // varchar(50)
            .input('UserID', sql.Int, userId)
            .input('CompanyID', sql.Int, companyId)
            .input('CreatedBy', sql.Int, createdBy)
            .input('ModifiedBy', sql.Int, modifiedBy)
            .input('aSRL', sql.VarChar(35), docNo)           // varchar(35)
            .input('aMainType', sql.VarChar(2), 'PR')        // varchar(2)
            .input('aSubType', sql.VarChar(2), 'RP')         // varchar(2)
            .input('aType', sql.VarChar(3), 'PUR')           // varchar(3)
            .input('aPrefix', sql.VarChar(8), prefix)        // varchar(8)
            .input('TransactionNumber', sql.VarChar(50), transactionNumber)
            .query(`INSERT INTO Ledger
           ([Sno]
           ,[CurrName]
           ,[CurrRate]
           ,[MainType]
           ,[SubType]
           ,[Type]
           ,[Srl]
           ,[DocDate]
           ,[Code]
           ,[Debit]
           ,[Credit]
           ,[Cheque]
           ,[RecoFlag]
           ,[ClearDate]
           ,[Narr]
           ,[Prefix]
           ,[Branch]
           ,[AltCode]
           ,[Party]
           ,[BillNumber]
           ,[BillDate]
           ,[ChequeDate]
           ,[DraweeBranch]
           ,[AccountName]
           ,[ReferenceCode]
           ,[UserID]
           ,[CompanyID]
           ,[CreatedBy]
           ,[CreatedDate]
           ,[ModifiedBy]
           ,[ModifiedDate]
           ,[aSRL]
           ,[aMainType]
           ,[aSubType]
           ,[aType]
           ,[aPrefix]
           ,TransactionNumber)
     VALUES
           (@Sno
           ,@CurrName
           ,@CurrRate 
           ,@MainType
           ,@SubType
           ,@Type
           ,@Srl
           ,@DocDate
           ,@Code
           ,@Debit
           ,@Credit
           ,@Cheque
           ,@RecoFlag
           ,@ClearDate
           ,@Narr
           ,@Prefix
           ,@Branch
           ,@AltCode
           ,@Party
           ,@BillNumber
           ,@BillDate
           ,@ChequeDate
           ,@DraweeBranch
           ,@AccountName
           ,@ReferenceCode
           ,@UserID
           ,@CompanyID
           ,@CreatedBy
           ,GETDATE()
           ,@ModifiedBy
           ,GETDATE()
           ,@aSrl
           ,@aMainType
           ,@aSubType
           ,@aType
           ,@aPrefix
           ,@TransactionNumber)`);

        // 2. Insert Discount Amount (Credit)
        if (netAmt > 0) {
            await connection.request()
                .input('Sno', sql.VarChar(5), '2')
                .input('CurrName', sql.VarChar(10), '')
                .input('CurrRate', sql.Money, 0.00)
                .input('MainType', sql.VarChar(2), 'PR')
                .input('SubType', sql.VarChar(2), 'NP')
                .input('Type', sql.VarChar(3), 'PRT')
                .input('Srl', sql.VarChar(35), docNo)
                .input('DocDate', sql.DateTime, new Date(docDate))
                .input('Code', sql.VarChar(9), '888888888')
                .input('Debit', sql.Money, 0.00)
                .input('Credit', sql.Money, netAmt)
                .input('Cheque', sql.VarChar(20), '')           // Added missing
                .input('RecoFlag', sql.VarChar(1), '')          // Added missing
                .input('ClearDate', sql.DateTime, new Date(docDate))         // Added missing
                .input('Narr', sql.Text, narration || '')       // Added missing
                .input('Prefix', sql.VarChar(8), prefix)        // Added missing
                .input('Branch', sql.VarChar(6), '')            // Added missing
                .input('AltCode', sql.VarChar(9), customerCode)           // Added missing
                .input('Party', sql.VarChar(9), partyCode)      // Added missing
                .input('BillNumber', sql.VarChar(255), billNo)  // Added missing
                .input('BillDate', sql.DateTime, new Date(billDate)) // Added missing
                .input('ChequeDate', sql.DateTime, new Date(billDate))        // Added missing
                .input('DraweeBranch', sql.VarChar(150), '')    // Added missing
                .input('AccountName', sql.VarChar(100), '')     // Added missing
                .input('ReferenceCode', sql.VarChar(50), '')    // Added missing
                .input('UserID', sql.Int, userId)               // Added missing
                .input('CompanyID', sql.Int, companyId)         // Added missing
                .input('CreatedBy', sql.Int, createdBy)         // Added missing
                .input('ModifiedBy', sql.Int, modifiedBy)       // Added missing
                .input('aSRL', sql.VarChar(35), docNo)         // Added missing
                .input('aMainType', sql.VarChar(2), 'PR')      // Added missing
                .input('aSubType', sql.VarChar(2), 'RP')       // Added missing
                .input('aType', sql.VarChar(3), 'PUR')         // Added missing
                .input('aPrefix', sql.VarChar(8), prefix)      // Added missing
                .input('TransactionNumber', sql.VarChar(50), transactionNumber)
                .query(`INSERT INTO Ledger
           ([Sno]
           ,[CurrName]
           ,[CurrRate]
           ,[MainType]
           ,[SubType]
           ,[Type]
           ,[Srl]
           ,[DocDate]
           ,[Code]
           ,[Debit]
           ,[Credit]
           ,[Cheque]
           ,[RecoFlag]
           ,[ClearDate]
           ,[Narr]
           ,[Prefix]
           ,[Branch]
           ,[AltCode]
           ,[Party]
           ,[BillNumber]
           ,[BillDate]
           ,[ChequeDate]
           ,[DraweeBranch]
           ,[AccountName]
           ,[ReferenceCode]
           ,[UserID]
           ,[CompanyID]
           ,[CreatedBy]
           ,[CreatedDate]
           ,[ModifiedBy]
           ,[ModifiedDate]
           ,[aSRL]
           ,[aMainType]
           ,[aSubType]
           ,[aType]
           ,[aPrefix]
           ,TransactionNumber)
     VALUES
           (@Sno
           ,@CurrName
           ,@CurrRate 
           ,@MainType
           ,@SubType
           ,@Type
           ,@Srl
           ,@DocDate
           ,@Code
           ,@Debit
           ,@Credit
           ,@Cheque
           ,@RecoFlag
           ,@ClearDate
           ,@Narr
           ,@Prefix
           ,@Branch
           ,@AltCode
           ,@Party
           ,@BillNumber
           ,@BillDate
           ,@ChequeDate
           ,@DraweeBranch
           ,@AccountName
           ,@ReferenceCode
           ,@UserID
           ,@CompanyID
           ,@CreatedBy
           ,GETDATE()
           ,@ModifiedBy
           ,GETDATE()
           ,@aSrl
           ,@aMainType
           ,@aSubType
           ,@aType
           ,@aPrefix
           ,@TransactionNumber)`);
        }

        // 3. Insert CGST Amount (Credit)
        if (cgst > 0) {
            await connection.request()
                .input('Sno', sql.VarChar(5), '3')
                .input('CurrName', sql.VarChar(10), '')
                .input('CurrRate', sql.Money, 0.00)
                .input('MainType', sql.VarChar(2), 'PR')
                .input('SubType', sql.VarChar(2), 'NP')
                .input('Type', sql.VarChar(3), 'PRT')
                .input('Srl', sql.VarChar(35), docNo)
                .input('DocDate', sql.DateTime, new Date(docDate))
                .input('Code', sql.VarChar(9), '888888884')
                .input('Debit', sql.Money, 0.00)
                .input('Credit', sql.Money, cgst)
                .input('Cheque', sql.VarChar(20), '')           // Added missing
                .input('RecoFlag', sql.VarChar(1), '')          // Added missing
                .input('ClearDate', sql.DateTime, new Date(docDate))         // Added missing
                .input('Narr', sql.Text, narration || '')       // Added missing
                .input('Prefix', sql.VarChar(8), prefix)        // Added missing
                .input('Branch', sql.VarChar(6), '')            // Added missing
                .input('AltCode', sql.VarChar(9), customerCode)           // Added missing
                .input('Party', sql.VarChar(9), partyCode)      // Added missing
                .input('BillNumber', sql.VarChar(255), billNo)  // Added missing
                .input('BillDate', sql.DateTime, new Date(billDate)) // Added missing
                .input('ChequeDate', sql.DateTime, new Date(billDate))        // Added missing
                .input('DraweeBranch', sql.VarChar(150), '')    // Added missing
                .input('AccountName', sql.VarChar(100), '')     // Added missing
                .input('ReferenceCode', sql.VarChar(50), '')    // Added missing
                .input('UserID', sql.Int, userId)               // Added missing
                .input('CompanyID', sql.Int, companyId)         // Added missing
                .input('CreatedBy', sql.Int, createdBy)         // Added missing
                .input('ModifiedBy', sql.Int, modifiedBy)       // Added missing
                .input('aSRL', sql.VarChar(35), docNo)         // Added missing
                .input('aMainType', sql.VarChar(2), 'PR')      // Added missing
                .input('aSubType', sql.VarChar(2), 'RP')       // Added missing
                .input('aType', sql.VarChar(3), 'PUR')         // Added missing
                .input('aPrefix', sql.VarChar(8), prefix)      // Added missing
                .input('TransactionNumber', sql.VarChar(50), transactionNumber)
                .query(`INSERT INTO Ledger
           ([Sno]
           ,[CurrName]
           ,[CurrRate]
           ,[MainType]
           ,[SubType]
           ,[Type]
           ,[Srl]
           ,[DocDate]
           ,[Code]
           ,[Debit]
           ,[Credit]
           ,[Cheque]
           ,[RecoFlag]
           ,[ClearDate]
           ,[Narr]
           ,[Prefix]
           ,[Branch]
           ,[AltCode]
           ,[Party]
           ,[BillNumber]
           ,[BillDate]
           ,[ChequeDate]
           ,[DraweeBranch]
           ,[AccountName]
           ,[ReferenceCode]
           ,[UserID]
           ,[CompanyID]
           ,[CreatedBy]
           ,[CreatedDate]
           ,[ModifiedBy]
           ,[ModifiedDate]
           ,[aSRL]
           ,[aMainType]
           ,[aSubType]
           ,[aType]
           ,[aPrefix]
           ,TransactionNumber)
     VALUES
           (@Sno
           ,@CurrName
           ,@CurrRate 
           ,@MainType
           ,@SubType
           ,@Type
           ,@Srl
           ,@DocDate
           ,@Code
           ,@Debit
           ,@Credit
           ,@Cheque
           ,@RecoFlag
           ,@ClearDate
           ,@Narr
           ,@Prefix
           ,@Branch
           ,@AltCode
           ,@Party
           ,@BillNumber
           ,@BillDate
           ,@ChequeDate
           ,@DraweeBranch
           ,@AccountName
           ,@ReferenceCode
           ,@UserID
           ,@CompanyID
           ,@CreatedBy
           ,GETDATE()
           ,@ModifiedBy
           ,GETDATE()
           ,@aSrl
           ,@aMainType
           ,@aSubType
           ,@aType
           ,@aPrefix
           ,@TransactionNumber)`);
        }

        // 4. Insert SGST Amount (Credit)
        if (sgst > 0) {
            await connection.request()
                .input('Sno', sql.VarChar(5), '4')
                .input('CurrName', sql.VarChar(10), '')
                .input('CurrRate', sql.Money, 0.00)
                .input('MainType', sql.VarChar(2), 'PR')
                .input('SubType', sql.VarChar(2), 'NP')
                .input('Type', sql.VarChar(3), 'PRT')
                .input('Srl', sql.VarChar(35), docNo)
                .input('DocDate', sql.DateTime, new Date(docDate))
                .input('Code', sql.VarChar(9), '888888885')
                .input('Debit', sql.Money, 0.00)
                .input('Credit', sql.Money, sgst)
                .input('Cheque', sql.VarChar(20), '')           // Added missing
                .input('RecoFlag', sql.VarChar(1), '')          // Added missing
                .input('ClearDate', sql.DateTime, new Date(docDate))         // Added missing
                .input('Narr', sql.Text, narration || '')       // Added missing
                .input('Prefix', sql.VarChar(8), prefix)        // Added missing
                .input('Branch', sql.VarChar(6), '')            // Added missing
                .input('AltCode', sql.VarChar(9), customerCode)           // Added missing
                .input('Party', sql.VarChar(9), partyCode)      // Added missing
                .input('BillNumber', sql.VarChar(255), billNo)  // Added missing
                .input('BillDate', sql.DateTime, new Date(billDate)) // Added missing
                .input('ChequeDate', sql.DateTime, new Date(billDate))        // Added missing
                .input('DraweeBranch', sql.VarChar(150), '')    // Added missing
                .input('AccountName', sql.VarChar(100), '')     // Added missing
                .input('ReferenceCode', sql.VarChar(50), '')    // Added missing
                .input('UserID', sql.Int, userId)               // Added missing
                .input('CompanyID', sql.Int, companyId)         // Added missing
                .input('CreatedBy', sql.Int, createdBy)         // Added missing
                .input('ModifiedBy', sql.Int, modifiedBy)       // Added missing
                .input('aSRL', sql.VarChar(35), docNo)         // Added missing
                .input('aMainType', sql.VarChar(2), 'PR')      // Added missing
                .input('aSubType', sql.VarChar(2), 'RP')       // Added missing
                .input('aType', sql.VarChar(3), 'PUR')         // Added missing
                .input('aPrefix', sql.VarChar(8), prefix)      // Added missing
                .input('TransactionNumber', sql.VarChar(50), transactionNumber)
                .query(`INSERT INTO Ledger
           ([Sno]
           ,[CurrName]
           ,[CurrRate]
           ,[MainType]
           ,[SubType]
           ,[Type]
           ,[Srl]
           ,[DocDate]
           ,[Code]
           ,[Debit]
           ,[Credit]
           ,[Cheque]
           ,[RecoFlag]
           ,[ClearDate]
           ,[Narr]
           ,[Prefix]
           ,[Branch]
           ,[AltCode]
           ,[Party]
           ,[BillNumber]
           ,[BillDate]
           ,[ChequeDate]
           ,[DraweeBranch]
           ,[AccountName]
           ,[ReferenceCode]
           ,[UserID]
           ,[CompanyID]
           ,[CreatedBy]
           ,[CreatedDate]
           ,[ModifiedBy]
           ,[ModifiedDate]
           ,[aSRL]
           ,[aMainType]
           ,[aSubType]
           ,[aType]
           ,[aPrefix]
           ,TransactionNumber)
     VALUES
           (@Sno
           ,@CurrName
           ,@CurrRate 
           ,@MainType
           ,@SubType
           ,@Type
           ,@Srl
           ,@DocDate
           ,@Code
           ,@Debit
           ,@Credit
           ,@Cheque
           ,@RecoFlag
           ,@ClearDate
           ,@Narr
           ,@Prefix
           ,@Branch
           ,@AltCode
           ,@Party
           ,@BillNumber
           ,@BillDate
           ,@ChequeDate
           ,@DraweeBranch
           ,@AccountName
           ,@ReferenceCode
           ,@UserID
           ,@CompanyID
           ,@CreatedBy
           ,GETDATE()
           ,@ModifiedBy
           ,GETDATE()
           ,@aSrl
           ,@aMainType
           ,@aSubType
           ,@aType
           ,@aPrefix
           ,@TransactionNumber)`);
        }

        // Insert into Outstanding table
        const outstandingQuery = `
            INSERT INTO Outstanding (
                Branch, MainType, SubType, Type, Prefix, Srl, Sno,
                aMainType, aSubType, aType, aPrefix, aSerial, aSno,
                CurrName, CurrRate, DocDate, Code, Amount, Pending,
                Flag, BillNumber, BillDate, CrPeriod, TdsAmt,
                OpnPending, OrdNumber, OrdDate, OpFlag, RefParty,
                Remark, ncode, AdvanceWithGST, UserID, CompanyID,
                TransactionNumber, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
            )
            VALUES (
                @Branch, @MainType, @SubType, @Type, @Prefix, @Srl, @Sno,
                @aMainType, @aSubType, @aType, @aPrefix, @aSerial, @aSno,
                @CurrName, @CurrRate, @DocDate, @Code, ROUND(@Amount, 0), ROUND(@Pending, 0),
                @Flag, @BillNumber, @BillDate, @CrPeriod, @TdsAmt,
                @OpnPending, @OrdNumber, @OrdDate, @OpFlag, @RefParty,
                @Remark, @ncode, @AdvanceWithGST, @UserID, @CompanyID,
                @TransactionNumber, @CreatedBy, GETDATE(), @ModifiedBy, GETDATE()
            )`;

        await connection.request()
            .input('Branch', sql.VarChar(6), '')
            .input('MainType', sql.VarChar(2), 'PR')
            .input('SubType', sql.VarChar(2), 'NP')
            .input('Type', sql.VarChar(3), 'PRT')
            .input('Prefix', sql.VarChar(8), prefix)
            .input('Srl', sql.VarChar(35), docNo)
            .input('Sno', sql.VarChar(5), '00001')
            .input('aMainType', sql.VarChar(2), 'PR')
            .input('aSubType', sql.VarChar(2), 'NP')
            .input('aType', sql.VarChar(3), 'PRT')
            .input('aPrefix', sql.VarChar(8), prefix)
            .input('aSerial', sql.VarChar(35), docNo)
            .input('aSno', sql.VarChar(5), '00001')
            .input('CurrName', sql.VarChar(10), '')
            .input('CurrRate', sql.Money, 0)
            .input('DocDate', sql.DateTime, docDate)
            .input('Code', sql.VarChar(30), customerCode)
            .input('Amount', sql.Money, billAmt)
            .input('Pending', sql.Money, billAmt)
            .input('Flag', sql.VarChar(1), 'C')
            .input('BillNumber', sql.VarChar(255), billNo)
            .input('BillDate', sql.DateTime, billDate)
            .input('CrPeriod', sql.Int, 30)
            .input('TdsAmt', sql.Money, 0)
            .input('OpnPending', sql.Money, 0)
            .input('OrdNumber', sql.VarChar(255), '')
            .input('OrdDate', sql.DateTime, docDate)
            .input('OpFlag', sql.VarChar(1), '')
            .input('RefParty', sql.VarChar(9), '')
            .input('Remark', sql.VarChar(500), '')
            .input('ncode', sql.VarChar(50), '')
            .input('AdvanceWithGST', sql.Bit, 0)
            .input('UserID', sql.Int, userId)
            .input('CompanyID', sql.Int, companyId)
            .input('TransactionNumber', sql.VarChar(50), transactionNumber)
            .input('CreatedBy', sql.Int, createdBy)
            .input('ModifiedBy', sql.Int, modifiedBy)
            .query(outstandingQuery);

        res.status(201).json({
            message: 'Invoice and Outstanding entry created successfully'
        });

    } catch (err: any) {
        console.error('Error creating purchase return:', err);
        if (!hasResponded) {
            hasResponded = true;
            res.status(500).json({ error: 'An error occurred while creating the purchase return', details: err.message });
        }
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.get('/purchase-return-items', async (req: Request, res: Response) => {
    let pool;
    try {
        // Get values from headers
        const userID = req.header('UserID');
        const companyID = req.header('CompanyID');
        const prefix = req.header('Prefix');

        // Validate headers
        if (!userID || !companyID || !prefix) {
            return res.status(400).json({ error: "Missing required headers: UserID, CompanyID, or Prefix" });
        }

        pool = await sql.connect(dbConfig);

        // Query for items
        const itemsRequest = pool.request();
        itemsRequest.input('UserID', sql.Int, parseInt(userID));
        itemsRequest.input('CompanyID', sql.Int, parseInt(companyID));

        const itemsQuery = `
            SELECT [ItemID], [ItemCode], [ItemName], [PurRate], [PurDisc], [SalRate], [SalDisc],
                   [Barcode], [OpeningStock], [Unit], [MRP], [TaxCode], [UserID], [CompanyID],
                   [CreatedBy], [CreatedDate], [ModifiedBy], [ModifiedDate], [GroupCode], [Flag],
                   [HSNCode], [TaxCategory], [GSTTaxCode], [IGSTTaxCode], [UTGSTTaxCode], [imgPath],
                   [Catagri], [grosswegiht], [netwegiht], [purity], [print], [makingcharge], [Othercharge]
            FROM [QuickbillBook].[dbo].[ItemMaster] 
            WHERE UserID = @UserID AND CompanyID = @CompanyID ORDER BY ItemName ASC`;

        const itemsResult = await itemsRequest.query(itemsQuery);

        // Query for last serial code
        const serialRequest = pool.request();
        serialRequest.input('UserID', sql.Int, parseInt(userID));
        serialRequest.input('CompanyID', sql.Int, parseInt(companyID));
        serialRequest.input('Prefix', sql.VarChar, prefix);

        const serialQuery = `
            Select top 1 isnull(DocNo,0) as SRL from purchase 
						where 
						MainType='PR' AND
                        SubType='RP' AND
						[Type]='PIR' 
						and Prefix=@Prefix
						and CompanyID=@CompanyID
						and UserID=@UserID
						order by DocNo desc`;



        const serialResult = await serialRequest.query(serialQuery);

        const lastSerial = serialResult.recordset[0]?.SRL || '0';
        const nextSerialNumber = parseInt(lastSerial) + 1;
        const nextSerial = nextSerialNumber.toString().padStart(6, '0');

        res.json({
            items: itemsResult.recordset,
            lastSerial: lastSerial,
            nextSerial: nextSerial
        });

    } catch (error) {
        console.error("Error while fetching items and serial", error);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        if (pool) {
            await pool.close();
        }
    }
});

app.get('/api/total-sales', async (req: Request, res: Response) => {
    let connection;
    try {
        const userID = req.header('UserID');
        const companyID = req.header('CompanyID');
        const prefix = req.header('Prefix');

        // Validate headers
        if (!userID || !companyID || !prefix) {
            return res.status(400).json({ error: "Missing required headers: UserID, CompanyID, or Prefix" });
        }

        connection = await getDbConnection();
        const request = connection.request();

        request.input('UserID', sql.Int, parseInt(userID));
        request.input('CompanyID', sql.Int, parseInt(companyID));
        request.input('Prefix', sql.VarChar, prefix);

        const query = `
            SELECT [SalesID]
                  ,[DocNo]
                  ,[DocDate]
                  ,[BillNo]
                  ,[BillDate]
                  ,[PartyCode]
                  ,[BillAmt]
                  ,[TotalQty]
                  ,[NetAmt]
                  ,[TaxAmt]
                  ,[DiscAmt]
           ,[MainType]
           ,[SubType]
           ,[Type]
                  ,[Prefix]
                  ,[UserID]
                  ,[CompanyID]
                  ,[CreatedBy]
                  ,[CreatedDate]
                  ,[ModifiedBy]
                  ,[ModifiedDate]
                  ,[PartyName]
                  ,[Selection]
                  ,[ProductName]
                  ,[DiscPer]
                  ,[CGST]
                  ,[SGST]
                  ,[IGST]
                  ,[UTGST]
                  ,[Narration]
                  ,[TotalAmt]
                  ,[Rate]
                  ,[Status]
                  ,[EWayBillNo]
                  ,[EWayBillDate]
                  ,[EWayBillValidTillDate]
                  ,[eInvStatus]
                  ,[eInvIRN]
                  ,[eInvAckNo]
                  ,[eInvAckDate]
                  ,[eInvSignedQRCodeData]
                  ,[eInvSignedQRCodeFileName]
                  ,[eInvRemarks]
                  ,[PlaceOfSuply]
                  ,[Transpoter]
                  ,[LRNo]
                  ,[ModeofTarn]
                  ,[NoPackage]
                  ,[Dispatch]
                  ,[FrihtMOP]
                  ,[AddCode]
                  ,[eInvCancleDate]
                  ,[Colour]
                  ,[Roundoff]
                  ,[ExtrCharch]
                  ,[DiscountExtra]
                  ,[Exchargelager]
                  ,[ExDicoutlager]
                  ,[debitpick]
                  ,[RefVoucherNo]
                  ,[RefVoucherDate]
                  ,[FileName]
              FROM [QuickbillBook].[dbo].[Sales]
              WHERE UserID = @UserID AND CompanyID = @CompanyID AND Prefix = @Prefix
        `;

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching total sales:", error);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.get('/api/total-purchases', async (req: Request, res: Response) => {
    let connection;
    try {
        const userID = req.header('UserID');
        const companyID = req.header('CompanyID');
        const prefix = req.header('Prefix');

        // Validate headers
        if (!userID || !companyID || !prefix) {
            return res.status(400).json({ error: "Missing required headers: UserID, CompanyID, or Prefix" });
        }

        connection = await getDbConnection();
        const request = connection.request();

        request.input('UserID', sql.Int, parseInt(userID));
        request.input('CompanyID', sql.Int, parseInt(companyID));
        request.input('Prefix', sql.VarChar, prefix);

        const query = `
        SELECT [PurchaseID]
      ,[DocNo]
           ,[DocDate]
      ,[BillNo]
      ,[BillDate]
      ,[PartyCode]
      ,[BillAmt]
      ,[TotalQty]
      ,[NetAmt]
      ,[TaxAmt]
      ,[DiscAmt]
      ,[MainType]
      ,[SubType]
      ,[Type]
           ,[Prefix]
           ,[UserID]
           ,[CompanyID]
           ,[CreatedBy]
           ,[CreatedDate]
           ,[ModifiedBy]
           ,[ModifiedDate]
      ,[PartyName]
      ,[Selection]
      ,[ProductName]
      ,[DiscPer]
      ,[CGST]
      ,[SGST]
      ,[IGST]
      ,[UTGST]
      ,[Narration]
      ,[TotalAmt]
      ,[Rate]
      ,[Status]
      ,[AddCode]
      ,[Roundoff]
      ,[ExtrCharch]
      ,[DiscountExtra]
      ,[Exchargelager]
      ,[ExDicoutlager]
  FROM [QuickbillBook].[dbo].[Purchase]
              WHERE UserID = @UserID AND CompanyID = @CompanyID AND Prefix = @Prefix
        `;

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching total sales:", error);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.get('/api/sales-vs-purchases', async (req: Request, res: Response) => {
    let connection;
    try {
        const userID = req.header('UserID');
        const companyID = req.header('CompanyID');
        const prefix = req.header('Prefix');

        // Validate headers
        if (!userID || !companyID || !prefix) {
            return res.status(400).json({ error: "Missing required headers: UserID, CompanyID, or Prefix" });
        }

        connection = await getDbConnection();
        const request = connection.request();

        request.input('UserID', sql.Int, parseInt(userID));
        request.input('CompanyID', sql.Int, parseInt(companyID));
        request.input('Prefix', sql.VarChar, prefix);

        // Fetch total sales
        const salesQuery = `
            SELECT SUM(BillAmt) AS TotalSales
            FROM [QuickbillBook].[dbo].[Sales]
            WHERE UserID = @UserID AND CompanyID = @CompanyID AND Prefix = @Prefix
        `;
        const salesResult = await request.query(salesQuery);
        const totalSales = salesResult.recordset[0]?.TotalSales || 0;

        // Fetch total purchases
        const purchasesQuery = `
            SELECT SUM(BillAmt) AS TotalPurchases
            FROM [QuickbillBook].[dbo].[Purchase]
            WHERE UserID = @UserID AND CompanyID = @CompanyID AND Prefix = @Prefix
        `;
        const purchasesResult = await request.query(purchasesQuery);
        const totalPurchases = purchasesResult.recordset[0]?.TotalPurchases || 0;

        // Return combined result
        res.json({
            totalSales,
            totalPurchases
        });
    } catch (error) {
        console.error("Error fetching sales vs purchases:", error);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.get('/api/accounts/cash', async (req: Request, res: Response) => {
    let connection;
    try {
        const userID = req.header('UserID');
        // const companyID = req.header('CompanyID');

        // Validate headers
        if (!userID) {
            return res.status(400).json({ error: "Missing required headers: UserID or CompanyID" });
        }

        connection = await sql.connect(dbConfig);

        const query = `
            SELECT TOP 1000 [CustomerID]
                  ,[CustomerName]
                  ,[CustomerGroup]
                  ,[CustomerType]
                  ,[ContactPerson]
                  ,[Address1]
                  ,[Address2]
                  ,[Address3]
                  ,[City]
                  ,[Pin]
                  ,[State]
                  ,[Country]
                  ,[Mobile1]
                  ,[Mobile2]
                  ,[Telephone1]
                  ,[Telephone2]
                  ,[Email]
                  ,[Website]
                  ,[GSTTIN]
                  ,[PANNo]
                  ,[VATNo]
                  ,[TINNo]
                  ,[LicenseNo1]
                  ,[License2]
                  ,[Opening]
                  ,[CompanyID]
                  ,[UserID]
                  ,[Tag1]
                  ,[Tag2]
                  ,[Tag3]
                  ,[Tag4]
                  ,[Tag5]
                  ,[CreatedBy]
                  ,[CreatedDate]
                  ,[ModifiedBy]
                  ,[ModifiedDate]
                  ,[Code]
                  ,[Flag]
                  ,[GroupCode]
                  ,[Aadhaar]
                  ,[Mssme]
                  ,[fssai]
                  ,[udyam]
              FROM [QuickbillBook].[dbo].[Customer]
              WHERE UserID in (0, @UserID) AND Tag5 = 'C' 
              ORDER BY CustomerName
        `;

        const result = await connection.request()
            .input('UserID', sql.Int, parseInt(userID))
            .query(query);

        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching cash accounts:", error);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.get('/api/accounts/bank', async (req: Request, res: Response) => {
    let connection;
    try {
        const userID = req.header('UserID');

        // Validate header
        if (!userID) {
            return res.status(400).json({ error: "Missing required header: UserID" });
        }

        connection = await sql.connect(dbConfig);

        const query = `
            SELECT TOP 1000 [CustomerID]
                  ,[CustomerName]
                  ,[CustomerGroup]
                  ,[CustomerType]
                  ,[ContactPerson]
                  ,[Address1]
                  ,[Address2]
                  ,[Address3]
                  ,[City]
                  ,[Pin]
                  ,[State]
                  ,[Country]
                  ,[Mobile1]
                  ,[Mobile2]
                  ,[Telephone1]
                  ,[Telephone2]
                  ,[Email]
                  ,[Website]
                  ,[GSTTIN]
                  ,[PANNo]
                  ,[VATNo]
                  ,[TINNo]
                  ,[LicenseNo1]
                  ,[License2]
                  ,[Opening]
                  ,[CompanyID]
                  ,[UserID]
                  ,[Tag1]
                  ,[Tag2]
                  ,[Tag3]
                  ,[Tag4]
                  ,[Tag5]
                  ,[CreatedBy]
                  ,[CreatedDate]
                  ,[ModifiedBy]
                  ,[ModifiedDate]
                  ,[Code]
                  ,[Flag]
                  ,[GroupCode]
                  ,[Aadhaar]
                  ,[Mssme]
                  ,[fssai]
                  ,[udyam]
              FROM [QuickbillBook].[dbo].[Customer]
              WHERE UserID = @UserID AND Tag5 = 'B' 
              ORDER BY CustomerName
        `;

        const result = await connection.request()
            .input('UserID', sql.Int, parseInt(userID))
            .query(query);

        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching bank accounts:", error);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.get('/api/bills', async (req: Request, res: Response) => {
    let connection;
    try {
        const userID = req.header('UserID');
        const companyID = req.header('CompanyID');
        const code = req.header('Code'); // Assuming you want to pass the Code as a header
        const prefix = req.header('Prefix'); // Assuming you want to pass the Prefix as a header

        // Validate headers
        if (!userID || !companyID || !code || !prefix) {
            return res.status(400).json({ error: "Missing required headers: UserID, CompanyID, Code, or Prefix" });
        }

        connection = await sql.connect(dbConfig);

        const query = `
            SELECT SRL,
                   Convert(varchar, DocDate, 103) AS [Date],
                   Prefix,
                   BillNumber AS BillNo,
                   CAST(Amount AS DECIMAL(18,2)) AS Amount,
                   CAST(Pending AS DECIMAL(18,2)) AS Balance,
                   '0' AS ReceivedBill,
                   MainType,
                   SubType,
                   [Type],
                   Sno 
            FROM Outstanding 
            WHERE SubType IN ('RS', 'NP') 
              AND Code = @Code 
              AND Pending > 0 
              AND Prefix = @Prefix 
              AND UserID = @UserID 
              AND CompanyID = @CompanyID 
            ORDER BY DocDate, SRL
        `;

        const result = await connection.request()
            .input('UserID', sql.Int, parseInt(userID))
            .input('CompanyID', sql.Int, parseInt(companyID))
            .input('Code', sql.VarChar, code)
            .input('Prefix', sql.VarChar, prefix)
            .query(query);

        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching bills:", error);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.post('/api/create-receipts', async (req: Request, res: Response) => {
    let connection;
    try {
        const {
            docDate,
            billNo,
            billDate,
            bankCode,
            amount,
            narration,
            prefix,
            customerCode,
            partyCode,
            userId,
            companyId,
            createdBy,
            modifiedBy
        } = req.body;

        connection = await sql.connect(dbConfig);

        // Get the last SRL number
        const getLastSrlRequest = connection.request()
            .input('MainType', sql.VarChar(2), 'RC')
            .input('SubType', sql.VarChar(2), 'BR')
            .input('Type', sql.VarChar(3), 'BRC')
            .input('Prefix', sql.VarChar(8), prefix)
            .input('CompanyID', sql.Int, companyId)
            .input('UserID', sql.Int, userId);

        const result = await getLastSrlRequest.query(`
            SELECT TOP 1 ISNULL(SRL, 0) as SRL 
            FROM Ledger 
            WHERE MainType = @MainType 
            AND SubType = @SubType 
            AND [Type] = @Type 
            AND Prefix = @Prefix
            AND CompanyID = @CompanyID
            AND UserID = @UserID
            ORDER BY SRL DESC
        `);

        // Generate new SRL number
        const lastSrl = result.recordset[0]?.SRL || 0;
        const newSrl = (parseInt(lastSrl) + 1).toString().padStart(6, '0');
        const docNo = newSrl; // You can format this differently if needed

        // Generate transaction number
        const transactionNumber = Math.floor(Math.random() * 1000000).toString();

        // 1. First Ledger Entry (Debit)
        await connection.request()
            .input('Sno', sql.VarChar(5), '1')
            .input('CurrName', sql.VarChar(10), '')
            .input('CurrRate', sql.Money, 0.00)
            .input('MainType', sql.VarChar(2), 'RC')
            .input('SubType', sql.VarChar(2), 'BR')
            .input('Type', sql.VarChar(3), 'BRC')
            .input('Srl', sql.VarChar(35), docNo)
            .input('DocDate', sql.DateTime, new Date(docDate))
            .input('Code', sql.VarChar(9), bankCode)
            .input('Debit', sql.Money, amount)
            .input('Credit', sql.Money, 0.00)
            .input('Cheque', sql.VarChar(20), '')
            .input('RecoFlag', sql.VarChar(1), '')
            .input('ClearDate', sql.DateTime, new Date(docDate))
            .input('Narr', sql.Text, narration || '')
            .input('Prefix', sql.VarChar(8), prefix)
            .input('Branch', sql.VarChar(6), '')
            .input('AltCode', sql.VarChar(9), customerCode)
            .input('Party', sql.VarChar(9), partyCode)
            .input('BillNumber', sql.VarChar(255), docNo)
            .input('BillDate', sql.DateTime, new Date(billDate))
            .input('ChequeDate', sql.DateTime, new Date(billDate))
            .input('DraweeBranch', sql.VarChar(150), '')
            .input('AccountName', sql.VarChar(100), '')
            .input('ReferenceCode', sql.VarChar(50), '')
            .input('UserID', sql.Int, userId)
            .input('CompanyID', sql.Int, companyId)
            .input('CreatedBy', sql.Int, createdBy)
            .input('ModifiedBy', sql.Int, modifiedBy)
            .input('aSRL', sql.VarChar(35), docNo)
            .input('aMainType', sql.VarChar(2), 'RC')
            .input('aSubType', sql.VarChar(2), 'BR')
            .input('aType', sql.VarChar(3), 'BRC')
            .input('aPrefix', sql.VarChar(8), prefix)
            .input('TransactionNumber', sql.VarChar(50), transactionNumber)
            .query(`
                INSERT INTO Ledger (
                    Sno, CurrName, CurrRate, MainType, SubType, Type, Srl, DocDate, Code,
                    Debit, Credit, Cheque, RecoFlag, ClearDate, Narr, Prefix, Branch,
                    AltCode, Party, BillNumber, BillDate, ChequeDate, DraweeBranch,
                    AccountName, ReferenceCode, UserID, CompanyID, CreatedBy, CreatedDate,
                    ModifiedBy, ModifiedDate, aSRL, aMainType, aSubType, aType, aPrefix,
                    TransactionNumber
                )
                VALUES (
                    @Sno, @CurrName, @CurrRate, @MainType, @SubType, @Type, @Srl,
                    @DocDate, @Code, @Debit, @Credit, @Cheque, @RecoFlag, @ClearDate,
                    @Narr, @Prefix, @Branch, @AltCode, @Party, @BillNumber, @BillDate,
                    @ChequeDate, @DraweeBranch, @AccountName, @ReferenceCode, @UserID,
                    @CompanyID, @CreatedBy, GETDATE(), @ModifiedBy, GETDATE(), @aSRL,
                    @aMainType, @aSubType, @aType, @aPrefix, @TransactionNumber
                )
            `);

        // 2. Second Ledger Entry (Credit)
        await connection.request()
            .input('Sno', sql.VarChar(5), '2')
            .input('CurrName', sql.VarChar(10), '')
            .input('CurrRate', sql.Money, 0.00)
            .input('MainType', sql.VarChar(2), 'RC')
            .input('SubType', sql.VarChar(2), 'BR')
            .input('Type', sql.VarChar(3), 'BRC')
            .input('Srl', sql.VarChar(35), docNo)
            .input('DocDate', sql.DateTime, new Date(docDate))
            .input('Code', sql.VarChar(9), customerCode)
            .input('Debit', sql.Money, 0.00)
            .input('Credit', sql.Money, amount)
            .input('Cheque', sql.VarChar(20), '')
            .input('RecoFlag', sql.VarChar(1), '')
            .input('ClearDate', sql.DateTime, new Date(docDate))
            .input('Narr', sql.Text, narration || '')
            .input('Prefix', sql.VarChar(8), prefix)
            .input('Branch', sql.VarChar(6), '')
            .input('AltCode', sql.VarChar(9), bankCode)
            .input('Party', sql.VarChar(9), customerCode)
            .input('BillNumber', sql.VarChar(255), docNo)
            .input('BillDate', sql.DateTime, new Date(billDate))
            .input('ChequeDate', sql.DateTime, new Date(billDate))
            .input('DraweeBranch', sql.VarChar(150), '')
            .input('AccountName', sql.VarChar(100), '')
            .input('ReferenceCode', sql.VarChar(50), '')
            .input('UserID', sql.Int, userId)
            .input('CompanyID', sql.Int, companyId)
            .input('CreatedBy', sql.Int, createdBy)
            .input('ModifiedBy', sql.Int, modifiedBy)
            .input('aSRL', sql.VarChar(35), docNo)
            .input('aMainType', sql.VarChar(2), 'RC')
            .input('aSubType', sql.VarChar(2), 'BR')
            .input('aType', sql.VarChar(3), 'BRC')
            .input('aPrefix', sql.VarChar(8), prefix)
            .input('TransactionNumber', sql.VarChar(50), transactionNumber)
            .query(`
                INSERT INTO Ledger (
                    Sno, CurrName, CurrRate, MainType, SubType, Type, Srl, DocDate, Code,
                    Debit, Credit, Cheque, RecoFlag, ClearDate, Narr, Prefix, Branch,
                    AltCode, Party, BillNumber, BillDate, ChequeDate, DraweeBranch,
                    AccountName, ReferenceCode, UserID, CompanyID, CreatedBy, CreatedDate,
                    ModifiedBy, ModifiedDate, aSRL, aMainType, aSubType, aType, aPrefix,
                    TransactionNumber
                )
                VALUES (
                    @Sno, @CurrName, @CurrRate, @MainType, @SubType, @Type, @Srl,
                    @DocDate, @Code, @Debit, @Credit, @Cheque, @RecoFlag, @ClearDate,
                    @Narr, @Prefix, @Branch, @AltCode, @Party, @BillNumber, @BillDate,
                    @ChequeDate, @DraweeBranch, @AccountName, @ReferenceCode, @UserID,
                    @CompanyID, @CreatedBy, GETDATE(), @ModifiedBy, GETDATE(), @aSRL,
                    @aMainType, @aSubType, @aType, @aPrefix, @TransactionNumber
                )
            `);

        // 3. First Outstanding Entry
        await connection.request()
            .input('Branch', sql.VarChar(6), '')
            .input('MainType', sql.VarChar(2), 'RC')
            .input('SubType', sql.VarChar(2), 'BR')
            .input('Type', sql.VarChar(3), 'BRC')
            .input('Prefix', sql.VarChar(8), prefix)
            .input('Srl', sql.VarChar(35), docNo)
            .input('Sno', sql.VarChar(5), '00001')
            .input('aMainType', sql.VarChar(2), 'RC')
            .input('aSubType', sql.VarChar(2), 'BR')
            .input('aType', sql.VarChar(3), 'BRC')
            .input('aPrefix', sql.VarChar(8), prefix)
            .input('aSerial', sql.VarChar(35), docNo)
            .input('aSno', sql.VarChar(5), '00001')
            .input('CurrName', sql.VarChar(10), '')
            .input('CurrRate', sql.Money, 0)
            .input('DocDate', sql.DateTime, new Date(docDate))
            .input('Code', sql.VarChar(30), customerCode)
            .input('Amount', sql.Money, amount)
            .input('Pending', sql.Money, amount)
            .input('Flag', sql.VarChar(1), 'C')
            .input('BillNumber', sql.VarChar(255), docNo)
            .input('BillDate', sql.DateTime, new Date(billDate))
            .input('CrPeriod', sql.Int, 30)
            .input('TdsAmt', sql.Money, 0)
            .input('OpnPending', sql.Money, 0)
            .input('OrdNumber', sql.VarChar(255), '')
            .input('OrdDate', sql.DateTime, new Date(docDate))
            .input('OpFlag', sql.VarChar(1), '')
            .input('RefParty', sql.VarChar(9), '')
            .input('Remark', sql.VarChar(500), '')
            .input('ncode', sql.VarChar(50), '')
            .input('AdvanceWithGST', sql.Bit, 0)
            .input('UserID', sql.Int, userId)
            .input('CompanyID', sql.Int, companyId)
            .input('TransactionNumber', sql.VarChar(50), transactionNumber)
            .input('CreatedBy', sql.Int, createdBy)
            .input('ModifiedBy', sql.Int, modifiedBy)
            .query(`
                INSERT INTO Outstanding (
                    Branch, MainType, SubType, Type, Prefix, Srl, Sno, aMainType,
                    aSubType, aType, aPrefix, aSerial, aSno, CurrName, CurrRate,
                    DocDate, Code, Amount, Pending, Flag, BillNumber, BillDate,
                    CrPeriod, TdsAmt, OpnPending, OrdNumber, OrdDate, OpFlag,
                    RefParty, Remark, ncode, AdvanceWithGST, UserID, CompanyID,
                    TransactionNumber, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
                )
                VALUES (
                    @Branch, @MainType, @SubType, @Type, @Prefix, @Srl, @Sno,
                    @aMainType, @aSubType, @aType, @aPrefix, @aSerial, @aSno,
                    @CurrName, @CurrRate, @DocDate, @Code, ROUND(@Amount, 0),
                    ROUND(@Pending, 0), @Flag, @BillNumber, @BillDate, @CrPeriod,
                    @TdsAmt, @OpnPending, @OrdNumber, @OrdDate, @OpFlag, @RefParty,
                    @Remark, @ncode, @AdvanceWithGST, @UserID, @CompanyID,
                    @TransactionNumber, @CreatedBy, GETDATE(), @ModifiedBy, GETDATE()
                )
            `);

        // 4. Second Outstanding Entry (with different MainType, SubType, Type)
        await connection.request()
            .input('Branch', sql.VarChar(6), '')
            .input('MainType', sql.VarChar(2), 'RC')
            .input('SubType', sql.VarChar(2), 'BR')
            .input('Type', sql.VarChar(3), 'BRC')
            .input('Prefix', sql.VarChar(8), prefix)
            .input('Srl', sql.VarChar(35), docNo)
            .input('Sno', sql.VarChar(5), '00001')
            .input('aMainType', sql.VarChar(2), 'SL')
            .input('aSubType', sql.VarChar(2), 'RS')
            .input('aType', sql.VarChar(3), 'SAL')
            .input('aPrefix', sql.VarChar(8), prefix)
            .input('aSerial', sql.VarChar(35), docNo)
            .input('aSno', sql.VarChar(5), '00001')
            .input('CurrName', sql.VarChar(10), '')
            .input('CurrRate', sql.Money, 0)
            .input('DocDate', sql.DateTime, new Date(docDate))
            .input('Code', sql.VarChar(30), customerCode)
            .input('Amount', sql.Money, amount)
            .input('Pending', sql.Money, 0)
            .input('Flag', sql.VarChar(1), '')
            .input('BillNumber', sql.VarChar(255), docNo)
            .input('BillDate', sql.DateTime, new Date(billDate))
            .input('CrPeriod', sql.Int, 30)
            .input('TdsAmt', sql.Money, 0)
            .input('OpnPending', sql.Money, 0)
            .input('OrdNumber', sql.VarChar(255), '')
            .input('OrdDate', sql.DateTime, new Date(docDate))
            .input('OpFlag', sql.VarChar(1), '')
            .input('RefParty', sql.VarChar(9), '')
            .input('Remark', sql.VarChar(500), '')
            .input('ncode', sql.VarChar(50), '')
            .input('AdvanceWithGST', sql.Bit, 0)
            .input('UserID', sql.Int, userId)
            .input('CompanyID', sql.Int, companyId)
            .input('TransactionNumber', sql.VarChar(50), transactionNumber)
            .input('CreatedBy', sql.Int, createdBy)
            .input('ModifiedBy', sql.Int, modifiedBy)
            .query(`
                INSERT INTO Outstanding (
                    Branch, MainType, SubType, Type, Prefix, Srl, Sno, aMainType,
                    aSubType, aType, aPrefix, aSerial, aSno, CurrName, CurrRate,
                    DocDate, Code, Amount, Pending, Flag, BillNumber, BillDate,
                    CrPeriod, TdsAmt, OpnPending, OrdNumber, OrdDate, OpFlag,
                    RefParty, Remark, ncode, AdvanceWithGST, UserID, CompanyID,
                    TransactionNumber, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
                )
                VALUES (
                    @Branch, @MainType, @SubType, @Type, @Prefix, @Srl, @Sno,
                    @aMainType, @aSubType, @aType, @aPrefix, @aSerial, @aSno,
                    @CurrName, @CurrRate, @DocDate, @Code, ROUND(@Amount, 0),
                    ROUND(@Pending, 0), @Flag, @BillNumber, @BillDate, @CrPeriod,
                    @TdsAmt, @OpnPending, @OrdNumber, @OrdDate, @OpFlag, @RefParty,
                    @Remark, @ncode, @AdvanceWithGST, @UserID, @CompanyID,
                    @TransactionNumber, @CreatedBy, GETDATE(), @ModifiedBy, GETDATE()
                )
            `);


        // 5. Update Outstanding Pending Amount
        // This should be added after the existing Outstanding entries
        for (const bill of req.body.bills) {  // Assuming bills are passed in request body
            await connection.request()
                .input('Pending', sql.Money, bill.balance - bill.receivedAmount)
                .input('Type', sql.VarChar(3), bill.type)
                .input('MainType', sql.VarChar(2), bill.mainType)
                .input('SubType', sql.VarChar(2), bill.subType)
                .input('Srl', sql.VarChar(35), bill.srl)
                .input('Prefix', sql.VarChar(8), prefix)
                .input('UserID', sql.Int, userId)
                .input('CompanyID', sql.Int, companyId)
                .query(`
        UPDATE Outstanding
        SET Pending = ROUND(@Pending, 0),
            ModifiedDate = GETDATE()
        WHERE [Type] = @Type
        AND MainType = @MainType
        AND SubType = @SubType
        AND Srl = @Srl
        AND Prefix = @Prefix
        AND [aType] = @Type
        AND aMainType = @MainType
        AND aSubType = @SubType
        AND [aSerial] = @Srl
        AND aPrefix = @Prefix
        AND UserID = @UserID
        AND CompanyID = @CompanyID;

        -- Update Purchase Status if Pending is 0
        IF ((SELECT Pending FROM Outstanding 
            WHERE Srl = @Srl 
            AND [Type] = @Type 
            AND Prefix = @Prefix 
            AND SubType = @SubType 
            AND MainType = @MainType 
            AND [aType] = @Type 
            AND aSubType = @SubType 
            AND [aSerial] = @Srl 
            AND aPrefix = @Prefix 
            AND UserID = @UserID 
            AND CompanyID = @CompanyID) = 0)
        BEGIN
            UPDATE Purchase 
            SET [Status] = 'Done' 
            WHERE [Type] = @Type
            AND MainType = @MainType
            AND SubType = @SubType
            AND DocNo = @Srl
            AND Prefix = @Prefix
            AND UserID = @UserID
            AND CompanyID = @CompanyID
        END
    `);
        }



        res.status(201).json({
            message: 'Receipt entries created successfully',
            transactionNumber
        });

    } catch (err: any) {
        console.error('Error creating receipt entries:', err);
        res.status(500).json({
            error: 'An error occurred while creating the receipt entries',
            details: err.message
        });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

app.post('/api/create-payment', async (req: Request, res: Response) => {
    let connection;
    try {
        const {
            docDate,
            billNo,
            billDate,
            bankCode,
            amount,
            narration,
            prefix,
            customerCode,
            partyCode,
            userId,
            companyId,
            createdBy,
            modifiedBy
        } = req.body;

        connection = await sql.connect(dbConfig);

        // Get the last SRL number
        const getLastSrlRequest = connection.request()
            .input('MainType', sql.VarChar(2), 'PM')
            .input('SubType', sql.VarChar(2), 'BP')
            .input('Type', sql.VarChar(3), 'BPM')
            .input('Prefix', sql.VarChar(8), prefix)
            .input('CompanyID', sql.Int, companyId)
            .input('UserID', sql.Int, userId);

        const result = await getLastSrlRequest.query(`
            SELECT TOP 1 ISNULL(SRL, 0) as SRL 
            FROM Ledger 
            WHERE MainType = @MainType 
            AND SubType = @SubType 
            AND [Type] = @Type 
            AND Prefix = @Prefix
            AND CompanyID = @CompanyID
            AND UserID = @UserID
            ORDER BY SRL DESC
        `);

        // Generate new SRL number
        const lastSrl = result.recordset[0]?.SRL || 0;
        const newSrl = (parseInt(lastSrl) + 1).toString().padStart(6, '0');
        const docNo = newSrl;

        // Generate transaction number
        const transactionNumber = Math.floor(Math.random() * 1000000).toString();

        // 1. First Ledger Entry (Debit)
        await connection.request()
            .input('Sno', sql.VarChar(5), '1')
            .input('CurrName', sql.VarChar(10), '')
            .input('CurrRate', sql.Money, 0.00)
            .input('MainType', sql.VarChar(2), 'PM')
            .input('SubType', sql.VarChar(2), 'BP')
            .input('Type', sql.VarChar(3), 'BPM')
            .input('Srl', sql.VarChar(35), docNo)
            .input('DocDate', sql.DateTime, new Date(docDate))
            .input('Code', sql.VarChar(9), customerCode)
            .input('Debit', sql.Money, amount)
            .input('Credit', sql.Money, 0.00)
            .input('Cheque', sql.VarChar(20), '')
            .input('RecoFlag', sql.VarChar(1), '')
            .input('ClearDate', sql.DateTime, new Date(docDate))
            .input('Narr', sql.Text, narration || '')
            .input('Prefix', sql.VarChar(8), prefix)
            .input('Branch', sql.VarChar(6), '')
            .input('AltCode', sql.VarChar(9), bankCode)
            .input('Party', sql.VarChar(9), partyCode)
            .input('BillNumber', sql.VarChar(255), docNo)
            .input('BillDate', sql.DateTime, new Date(billDate))
            .input('ChequeDate', sql.DateTime, new Date(billDate))
            .input('DraweeBranch', sql.VarChar(150), '')
            .input('AccountName', sql.VarChar(100), '')
            .input('ReferenceCode', sql.VarChar(50), '')
            .input('UserID', sql.Int, userId)
            .input('CompanyID', sql.Int, companyId)
            .input('CreatedBy', sql.Int, createdBy)
            .input('ModifiedBy', sql.Int, modifiedBy)
            .input('aSRL', sql.VarChar(35), docNo)
            .input('aMainType', sql.VarChar(2), 'PM')
            .input('aSubType', sql.VarChar(2), 'BP')
            .input('aType', sql.VarChar(3), 'BPM')
            .input('aPrefix', sql.VarChar(8), prefix)
            .input('TransactionNumber', sql.VarChar(50), transactionNumber)
            .query(`
                INSERT INTO Ledger (
                    Sno, CurrName, CurrRate, MainType, SubType, Type, Srl, DocDate, Code,
                    Debit, Credit, Cheque, RecoFlag, ClearDate, Narr, Prefix, Branch,
                    AltCode, Party, BillNumber, BillDate, ChequeDate, DraweeBranch,
                    AccountName, ReferenceCode, UserID, CompanyID, CreatedBy, CreatedDate,
                    ModifiedBy, ModifiedDate, aSRL, aMainType, aSubType, aType, aPrefix,
                    TransactionNumber
                )
                VALUES (
                    @Sno, @CurrName, @CurrRate, @MainType, @SubType, @Type, @Srl,
                    @DocDate, @Code, @Debit, @Credit, @Cheque, @RecoFlag, @ClearDate,
                    @Narr, @Prefix, @Branch, @AltCode, @Party, @BillNumber, @BillDate,
                    @ChequeDate, @DraweeBranch, @AccountName, @ReferenceCode, @UserID,
                    @CompanyID, @CreatedBy, GETDATE(), @ModifiedBy, GETDATE(), @aSRL,
                    @aMainType, @aSubType, @aType, @aPrefix, @TransactionNumber
                )
            `);

        // 2. Second Ledger Entry (Credit)
        await connection.request()
            .input('Sno', sql.VarChar(5), '2')
            .input('CurrName', sql.VarChar(10), '')
            .input('CurrRate', sql.Money, 0.00)
            .input('MainType', sql.VarChar(2), 'PM')
            .input('SubType', sql.VarChar(2), 'BP')
            .input('Type', sql.VarChar(3), 'BPM')
            .input('Srl', sql.VarChar(35), docNo)
            .input('DocDate', sql.DateTime, new Date(docDate))
            .input('Code', sql.VarChar(9), bankCode)
            .input('Debit', sql.Money, 0.00)
            .input('Credit', sql.Money, amount)
            .input('Cheque', sql.VarChar(20), '')
            .input('RecoFlag', sql.VarChar(1), '')
            .input('ClearDate', sql.DateTime, new Date(docDate))
            .input('Narr', sql.Text, narration || '')
            .input('Prefix', sql.VarChar(8), prefix)
            .input('Branch', sql.VarChar(6), '')
            .input('AltCode', sql.VarChar(9), customerCode)
            .input('Party', sql.VarChar(9), customerCode)
            .input('BillNumber', sql.VarChar(255), docNo)
            .input('BillDate', sql.DateTime, new Date(billDate))
            .input('ChequeDate', sql.DateTime, new Date(billDate))
            .input('DraweeBranch', sql.VarChar(150), '')
            .input('AccountName', sql.VarChar(100), '')
            .input('ReferenceCode', sql.VarChar(50), '')
            .input('UserID', sql.Int, userId)
            .input('CompanyID', sql.Int, companyId)
            .input('CreatedBy', sql.Int, createdBy)
            .input('ModifiedBy', sql.Int, modifiedBy)
            .input('aSRL', sql.VarChar(35), docNo)
            .input('aMainType', sql.VarChar(2), 'PM')
            .input('aSubType', sql.VarChar(2), 'BP')
            .input('aType', sql.VarChar(3), 'BPM')
            .input('aPrefix', sql.VarChar(8), prefix)
            .input('TransactionNumber', sql.VarChar(50), transactionNumber)
            .query(`
                INSERT INTO Ledger (
                    Sno, CurrName, CurrRate, MainType, SubType, Type, Srl, DocDate, Code,
                    Debit, Credit, Cheque, RecoFlag, ClearDate, Narr, Prefix, Branch,
                    AltCode, Party, BillNumber, BillDate, ChequeDate, DraweeBranch,
                    AccountName, ReferenceCode, UserID, CompanyID, CreatedBy, CreatedDate,
                    ModifiedBy, ModifiedDate, aSRL, aMainType, aSubType, aType, aPrefix,
                    TransactionNumber
                )
                VALUES (
                    @Sno, @CurrName, @CurrRate, @MainType, @SubType, @Type, @Srl,
                    @DocDate, @Code, @Debit, @Credit, @Cheque, @RecoFlag, @ClearDate,
                    @Narr, @Prefix, @Branch, @AltCode, @Party, @BillNumber, @BillDate,
                    @ChequeDate, @DraweeBranch, @AccountName, @ReferenceCode, @UserID,
                    @CompanyID, @CreatedBy, GETDATE(), @ModifiedBy, GETDATE(), @aSRL,
                    @aMainType, @aSubType, @aType, @aPrefix, @TransactionNumber
                )
            `);

        // 3. First Outstanding Entry
        await connection.request()
            .input('Branch', sql.VarChar(6), '')
            .input('MainType', sql.VarChar(2), 'PM')
            .input('SubType', sql.VarChar(2), 'BP')
            .input('Type', sql.VarChar(3), 'BPM')
            .input('Prefix', sql.VarChar(8), prefix)
            .input('Srl', sql.VarChar(35), docNo)
            .input('Sno', sql.VarChar(5), '00001')
            .input('aMainType', sql.VarChar(2), 'PM')
            .input('aSubType', sql.VarChar(2), 'BP')
            .input('aType', sql.VarChar(3), 'BPM')
            .input('aPrefix', sql.VarChar(8), prefix)
            .input('aSerial', sql.VarChar(35), docNo)
            .input('aSno', sql.VarChar(5), '00001')
            .input('CurrName', sql.VarChar(10), '')
            .input('CurrRate', sql.Money, 0)
            .input('DocDate', sql.DateTime, new Date(docDate))
            .input('Code', sql.VarChar(30), customerCode)
            .input('Amount', sql.Money, amount)
            .input('Pending', sql.Money, amount)
            .input('Flag', sql.VarChar(1), 'D')
            .input('BillNumber', sql.VarChar(255), docNo)
            .input('BillDate', sql.DateTime, new Date(billDate))
            .input('CrPeriod', sql.Int, 30)
            .input('TdsAmt', sql.Money, 0)
            .input('OpnPending', sql.Money, 0)
            .input('OrdNumber', sql.VarChar(255), '')
            .input('OrdDate', sql.DateTime, new Date(docDate))
            .input('OpFlag', sql.VarChar(1), '')
            .input('RefParty', sql.VarChar(9), '')
            .input('Remark', sql.VarChar(500), '')
            .input('ncode', sql.VarChar(50), '')
            .input('AdvanceWithGST', sql.Bit, 0)
            .input('UserID', sql.Int, userId)
            .input('CompanyID', sql.Int, companyId)
            .input('TransactionNumber', sql.VarChar(50), transactionNumber)
            .input('CreatedBy', sql.Int, createdBy)
            .input('ModifiedBy', sql.Int, modifiedBy)
            .query(`
                INSERT INTO Outstanding (
                    Branch, MainType, SubType, Type, Prefix, Srl, Sno, aMainType,
                    aSubType, aType, aPrefix, aSerial, aSno, CurrName, CurrRate,
                    DocDate, Code, Amount, Pending, Flag, BillNumber, BillDate,
                    CrPeriod, TdsAmt, OpnPending, OrdNumber, OrdDate, OpFlag,
                    RefParty, Remark, ncode, AdvanceWithGST, UserID, CompanyID,
                    TransactionNumber, CreatedBy, CreatedDate, ModifiedBy, ModifiedDate
                )
                VALUES (
                    @Branch, @MainType, @SubType, @Type, @Prefix, @Srl, @Sno,
                    @aMainType, @aSubType, @aType, @aPrefix, @aSerial, @aSno,
                    @CurrName, @CurrRate, @DocDate, @Code, ROUND(@Amount, 0),
                    ROUND(@Pending, 0), @Flag, @BillNumber, @BillDate, @CrPeriod,
                    @TdsAmt, @OpnPending, @OrdNumber, @OrdDate, @OpFlag, @RefParty,
                    @Remark, @ncode, @AdvanceWithGST, @UserID, @CompanyID,
                    @TransactionNumber, @CreatedBy, GETDATE(), @ModifiedBy, GETDATE()
                )
            `);

        // 5. Update Outstanding Pending Amount
        // This should be added after the existing Outstanding entries
        for (const bill of req.body.bills) {  // Assuming bills are passed in request body
            await connection.request()
                .input('Pending', sql.Money, bill.balance - bill.receivedAmount)
                .input('Type', sql.VarChar(3), bill.type)
                .input('MainType', sql.VarChar(2), bill.mainType)
                .input('SubType', sql.VarChar(2), bill.subType)
                .input('Srl', sql.VarChar(35), bill.srl)
                .input('Prefix', sql.VarChar(8), prefix)
                .input('UserID', sql.Int, userId)
                .input('CompanyID', sql.Int, companyId)
                .query(`
        UPDATE Outstanding
        SET Pending = ROUND(@Pending, 0),
            ModifiedDate = GETDATE()
        WHERE [Type] = @Type
        AND MainType = @MainType
        AND SubType = @SubType
        AND Srl = @Srl
        AND Prefix = @Prefix
        AND [aType] = @Type
        AND aMainType = @MainType
        AND aSubType = @SubType
        AND [aSerial] = @Srl
        AND aPrefix = @Prefix
        AND UserID = @UserID
        AND CompanyID = @CompanyID;

        -- Update Purchase Status if Pending is 0
        IF ((SELECT Pending FROM Outstanding 
            WHERE Srl = @Srl 
            AND [Type] = @Type 
            AND Prefix = @Prefix 
            AND SubType = @SubType 
            AND MainType = @MainType 
            AND [aType] = @Type 
            AND aSubType = @SubType 
            AND [aSerial] = @Srl 
            AND aPrefix = @Prefix 
            AND UserID = @UserID 
            AND CompanyID = @CompanyID) = 0)
        BEGIN
            UPDATE Purchase 
            SET [Status] = 'Done' 
            WHERE [Type] = @Type
            AND MainType = @MainType
            AND SubType = @SubType
            AND DocNo = @Srl
            AND Prefix = @Prefix
            AND UserID = @UserID
            AND CompanyID = @CompanyID
        END
    `);
        }



        res.status(201).json({
            message: 'Payment entries created successfully',
            transactionNumber
        });

    } catch (err: any) {
        console.error('Error creating payment entries:', err);
        res.status(500).json({
            error: 'An error occurred while creating the payment entries',
            details: err.message
        });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});


module.exports = app;
