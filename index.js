const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const  bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const serverless = require('aws-serverless-express');

const app = express();

app.use(bodyParser.json());

//Hadle the acces
app.use(cors({
    origin: '*', 
    methods: 'GET,PUT,POST',
    credentials: true,
}));

//Handle the log
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
})

//Image middleware handling
app.use('/images', express.static(path.join(__dirname, 'images'), { fallthrough: false }));

app.use((err, req, res, next) => {
    if (err.code === 'ENOENT') {
      res.status(404).send('Image not found');
    } else {
      next("Error:" + err);
    }
});


//Mongo DB URI
const mongoPassword = "YYBsmknVzWQwEume";
const mongoURI = "mongodb+srv://dionisbarcari:" + mongoPassword + "@cluster0.v1v6hrj.mongodb.net/?retryWrites=true&w=majority";

//Mongo DB client initiating
const client = new MongoClient(mongoURI , {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
});

//Send the request ot the database
async function getDataFromDatabase(querry, collection) {
    let lessonsArray;

    try {
        await client.connect();

        let lessons = client.db('Coursework2Mobile').collection(collection);

        lessonsArray = await lessons.find(querry).toArray();
    } catch(e){
        console.log('Error conection to the Database: ', err)
    }

    return lessonsArray;
}

//Place the order to the database
async function placeOrder(order) {
    try {
        await client.connect();

        const ordersDB = client.db('Coursework2Mobile').collection('orders');
        const result = await ordersDB.insertOne(order);

        if (result.insertedId !== undefined) {
            console.log(`Order inserted with ID: ${result.insertedId}`);
            return true;
        } else {
            console.log('Failed to insert the order.');
            return false; 
        }
    } catch(err) {
        console.log('Error conection to the Database: ', err)
        return false;
    } finally {
        await client.close();
    }

}

//Update the database/lessons spaces
async function updateDatabaseSapces(ordeIDs) {
    try {
        await client.connect();

        const lessons = client.db('Coursework2Mobile').collection('lessons');

        for (let lesson of ordeIDs) {
            const { id, count } = lesson;
      
            //Convert the data to the MongoDB format and update
            const result = await lessons.updateOne(
              { _id: new ObjectId(id) },
              { $inc: { spaces: -count } }
            )
        }
        return true;
    } catch(error) {
        console.log('Error conection to the Database: ', error)
        return false;
    } finally {
        await client.close();
    }
}

//Get lessons data and search functionality
app.get("/lessons", (req, res) => {
    let searchValue;

    if(req.query.src == undefined) {
        searchValue = '';
    } else {
        searchValue = req.query.src;
    }
  

    let querry = {
        $or: [
            { subject: { $regex: searchValue , $options: 'i' } }, 
            { location: { $regex: searchValue , $options: 'i' } }
          ],
    }

    getDataFromDatabase(querry, 'lessons')
        .then((data) => {
            res.json(data);
        }).catch(err => console.log('Error Connecting to the Database: ', err))
})

//Receive and handle new orders
app.post("/placeorder", async (req, res) => {
    let order = req.body;
    let isInserted = await placeOrder(order);

    if(isInserted) {
        res.sendStatus(200);
    } else {
        res.sendStatus(500);
    }
})

//PUT =, update the lessons spaces route
app.put("/update-spaces", async (req, res) => {
    let ordeIDs = req.body;

    let isUpdated = await updateDatabaseSapces(ordeIDs);

    if(isUpdated) {
        res.sendStatus(200);
    } else {
        res.sendStatus(500);
    }
})


const server = serverless.createServer(app);

//Export the handler function
exports.handler = (event, context) => serverless.proxy(server, event, context);