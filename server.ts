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
                INNER JOIN CompanyMaster c ON c.CompanyID = s.CompanyID  -- Join to get CompanyName
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






