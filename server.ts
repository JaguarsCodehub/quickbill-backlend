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
            docNo, docDate, billNo, billDate, partyCode, billAmt, totalQty, netAmt, taxAmt, discAmt,
            mainType, subType, type, prefix, narration, userId, companyId, createdBy, modifiedBy,
            partyName, selection, productName, discPer, cgst, sgst, igst, utgst, rate, totalAmt,
            status, addCode, roundoff, extrCharch, discountExtra, exchargelager,
            refVoucherNo, refVoucherDate, fileName, transpoter, lrNo, eWayBillNo, modeofTarn,
            dispatch, noPackage, eInvRemarks, placeOfSuply,
            items // Array of items for SalesStk
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

        res.status(201).json({ message: 'Invoice created successfully', salesId: salesId });
    } catch (err: any) {
        console.error('Error creating invoice:', err);
        res.status(500).json({ error: 'An error occurred while creating the invoice', details: err.message });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

module.exports = app;
