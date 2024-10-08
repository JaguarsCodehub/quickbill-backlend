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
        connection = await getDbConnection();
        const request = connection.request();

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
                        WHERE UserId = 1
                    `

        const result = await request.query(query);
        res.json(result.recordset);

    } catch (error) {
        console.error("Error while fetching customers", error)
    }
})

app.get('/items', async (req: Request, res: Response) => {
    let connection;
    try {
        // Get values from headers
        const userID = req.header('UserID');
        const companyID = req.header('CompanyID');
        const prefix = req.header('Prefix');

        // Validate headers
        if (!userID || !companyID || !prefix) {
            return res.status(400).json({ error: "Missing required headers: UserID, CompanyID, or Prefix" });
        }

        connection = await getDbConnection();
        const request = connection.request();

        // Query for items
        const itemsQuery = `
            SELECT [ItemID], [ItemCode], [ItemName], [PurRate], [PurDisc], [SalRate], [SalDisc],
                   [Barcode], [OpeningStock], [Unit], [MRP], [TaxCode], [UserID], [CompanyID],
                   [CreatedBy], [CreatedDate], [ModifiedBy], [ModifiedDate], [GroupCode], [Flag],
                   [HSNCode], [TaxCategory], [GSTTaxCode], [IGSTTaxCode], [UTGSTTaxCode], [imgPath],
                   [Catagri], [grosswegiht], [netwegiht], [purity], [print], [makingcharge], [Othercharge]
            FROM [QuickbillBook].[dbo].[ItemMaster] 
            WHERE UserID = @UserID AND CompanyID = @CompanyID`;

        // Query for last serial code
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

        const itemsResult = await request
            .input('UserID', sql.Int, parseInt(userID))
            .input('CompanyID', sql.Int, parseInt(companyID))
            .query(itemsQuery);

        const serialResult = await request
            .input('UserID', sql.Int, parseInt(userID))
            .input('CompanyID', sql.Int, parseInt(companyID))
            .input('Prefix', sql.VarChar, prefix)
            .query(serialQuery);

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
        if (connection) {
            await connection.close();
        }
    }
});