const express= require("express");
const path = require('path');
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const cors= require('cors')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

const app=express()
app.use(express.json());
app.use(cors())
const PORT = process.env.PORT || 3000;

const dbPath = path.join(__dirname, "traveldairy.db")

let db = null;

const initializeDBAndServer = async () => {
    try{
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        })

        // Drop 'users' table if it exists
        await db.run(`DROP TABLE IF EXISTS users`);

        // Create a 'users' table if it doesn't exist
        await db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        `);

       // Drop 'travel' table if it exists
       await db.run(`DROP TABLE IF EXISTS travel`);

       // Create a 'travel' table if it doesn't exist
       await db.run(`
           CREATE TABLE IF NOT EXISTS travel (
               id INTEGER PRIMARY KEY,
               title TEXT NOT NULL,
               description TEXT NOT NULL,
               date TEXT NOT NULL,
               location TEXT NOT NULL,
               user_id INTEGER,
               FOREIGN KEY (user_id) REFERENCES users(id)
           )
       `);

        app.listen(PORT,()=> {
            console.log('server  running at port',PORT)
        })
        
    }
    catch(e){
        console.log(`DB Error: ${e.message}`);
        process.exit(1);
    }
}
initializeDBAndServer();

// Middleware function for authentication
const authenticateUser = async (req, res, next) => {
    try {
        // Check if Authorization header is present
        if (!req.headers.authorization) {
            return res.status(401).json({ error: "Authorization header is missing" });
        }

        // Extract token from Authorization header
        const token = req.headers.authorization.split(" ")[1];
        if (!token) {
            return res.status(401).json({ error: "Token is missing" });
        }

        // Verify token and extract user id
        const decoded = jwt.verify(token, "SECRET_KEY");
        const userId = decoded.userId;
    

        // Fetch user from database based on user id
        const user = await db.get(
            `SELECT * FROM users WHERE id = ?`,
            [userId]
        );

        // If user not found, send error response
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        // Store user in request object for further use
        req.user = user;
        
        next();
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Route to register a new user
app.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.run(
            `INSERT INTO users (email, password) VALUES (?, ?)`,
            [email, hashedPassword]
        );

        res.send("User registered successfully");
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal server error");
    }
});

// Route to login
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await db.get(
            `SELECT * FROM users WHERE email = ?`,
            [email]
        );

        if (!user) {
            res.status(400).json({ error: "Invalid credentials" });
        } else {
            const validPassword = await bcrypt.compare(password, user.password);
            if (validPassword) {
                const token = jwt.sign({ userId: user.id }, "SECRET_KEY");
                res.json({ token });
            } else {
                res.status(400).json({ error: "Invalid credentials" });
            }
        }
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal server error");
    }
});



//route to add a travel entry
app.post('/diary', authenticateUser, async (request, response)=> {
    try{
        const {id, title, description, date, location} = request.body;
       
        const addEntry = ` INSERT INTO travel(id,title, description, date, location) 
            VALUES(${id},'${title}', '${description}', '${date}', '${location}')`;

        await db.run(addEntry);
        response.send("Travel entry added successfully");
    }
    catch(error){
        console.log(error);
    }
})

// Route to get all travel entries
app.get('/diary', authenticateUser, async (request, response) => {
    try {
        
        const getAllEntries = `
            SELECT * FROM travel 
        `;

        const entries = await db.all(getAllEntries);

        if (entries.length === 0) {
            response.status(404).send("No travel entries found");
        } else {
            response.json(entries);
        }
    } catch (error) {
        console.log(error);
    }
});

// Route to update a travel entry
app.put('/diary/:id', authenticateUser, async (request, response) => {
    try {
        const { id } = request.params;
        const { title,description, date, location } = request.body;
        const updateEntry = `
            UPDATE travel
            SET title='${title}' , description = '${description}', date = '${date}', location = '${location}'
            WHERE id = ${id} 
        `;
        await db.run(updateEntry);
        response.send(`Travel entry "${title}" updated successfully`);
    } catch (error) {
        console.log(error);
    }
});

// Route to delete a travel entry
app.delete('/diary/:id', authenticateUser, async (request, response) => {
    try {
        const { id } = request.params;
        const deleteEntry = `
            DELETE FROM travel
            WHERE id = ${id} 
        `;
        await db.run(deleteEntry);
        response.send(`Travel entry "${id}" deleted successfully`);
    } catch (error) {
        console.log(error);
    }
});

app.get('/', (req, res)=> {
    res.send("Hello, Welcome")
})
