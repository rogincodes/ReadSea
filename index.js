import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

//Middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

//Connect to database
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "bookshelf",
  password: "PostgresinG",
  port: 5432,
});
db.connect();

let featured = [];
let random = [];
let latest = [];
let invalidISBN = "";
let specifiedBook = [];
let currentID = 0;

async function getFeatured() {
  try {
    const result = await db.query("SELECT * FROM books WHERE rating = 10 LIMIT 10;");
    featured = result.rows;
  } catch (err) {
    console.err(err);
  } 
};

async function randomBook() {
  if (featured != 0) {  
    const num = Math.floor(Math.random() * featured.length);
    random = featured[num];
    console.log(num);
  } else {};
};

async function getLatest() {
  try {
    const result = await db.query("SELECT * FROM books ORDER BY date_read DESC LIMIT 3;");
    latest = result.rows;
  } catch (err) {
    console.err(err);
  } 
};

//GET index file
app.get("/", async (req, res) => {
  await getFeatured();
  await randomBook();
  await getLatest();

  res.render("index.ejs",
    { 
      lucky: random,
      featuredBooks: featured,
      latestBooks: latest,
      isbnError: invalidISBN,
    });
});

//GET navigate to add book
app.get("/#add-book", async (req, res) => {
  await getFeatured();
  await randomBook();
  await getLatest();

  res.render("index.ejs",
    { 
      lucky: random,
      featuredBooks: featured,
      latestBooks: latest,
      isbnError: invalidISBN,
    });
});

//POST new book
app.post("/add", async (req, res) => {
  const isbn = req.body.isbn;
  const title = req.body.title;
  const author = req.body.author;
  const genre = req.body.genre;
  const date = req.body.dateRead;
  const rating = req.body.rating;
  const review = req.body.review;
  const notes = req.body.notes;

  try {
    //GET book cover from API
    const result = await axios.get(`https://bookcover.longitood.com/bookcover/${isbn}`);
    const img_URL = result.data.url;

    //INSERT data
    try {
      await db.query("INSERT INTO books (isbn, title, author, genre, img_URL, date_Read, rating, review, notes)VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);", [ isbn, title, author, genre, img_URL, date, rating, review, notes ]);
      invalidISBN = "";
      res.redirect("/");
    } catch (err) {
      console.error(err);
    }
  } catch (err) {
    console.error(err);
    invalidISBN = "Invalid input: Please use ISBN-13.";
    res.redirect("/#add-book");
  }
});

//GET a specified book by id
app.get("/journal/:id", async (req, res) => {
  const rawId = req.params.id.trim();
  const id = parseInt(rawId, 10); 
  if (isNaN(id)) {
    return res.status(400).send('Invalid ID');
  }

  try {
    const result = await db.query("SELECT * FROM books WHERE id = $1", [ id ]);
    specifiedBook = result.rows[0];
    res.render("journal.ejs",
      {
        book: specifiedBook,
        featuredBooks: featured
      }
    );
  } catch (err) {
    console.log(err);
  } 
});

//GET edit.ejs
app.get("/edit.ejs", async (req, res) => {
  const dateTimeString = specifiedBook.date_read;
  let dateOnly;
  if (typeof dateTimeString === 'string') {
    dateOnly = dateTimeString.split('T')[0];
  } else if (dateTimeString instanceof Date) {
    dateOnly = dateTimeString.toISOString().split('T')[0];
  } else {
    console.error('Invalid date format');
  }
  specifiedBook.date_read = dateOnly;
  res.render("edit.ejs", 
    {
      book: specifiedBook,
      isbnError: invalidISBN,
    }
  );
});

//UPDATE book data
app.post("/modify", async (req, res) => {
  const isbn = req.body.isbn;
  const title = req.body.title;
  const author = req.body.author;
  const genre = req.body.genre;
  const date = req.body.dateRead;
  const rating = req.body.rating;
  const review = req.body.review;
  const notes = req.body.notes;
  const id = specifiedBook.id

  try {
    //GET book cover from API
    const result = await axios.get(`https://bookcover.longitood.com/bookcover/${isbn}`);
    const img_URL = result.data.url;

    //UPDATE data
    try {
      await db.query("UPDATE books set isbn = $1, title = $2, author = $3, genre = $4, img_URL = $5, date_Read = $6, rating = $7, review = $8, notes = $9 WHERE id = $10;", [ isbn, title, author, genre, img_URL, date, rating, review, notes, id ]);
      invalidISBN = "";
      res.redirect("/");
    } catch (err) {
      console.error(err);
    }
  } catch (err) {
    console.error(err);
    invalidISBN = "Invalid input: Please use ISBN-13.";
    res.redirect("/edit.ejs");
  }
});

app.post("/delete/:id", async (req, res) => {
  const id = specifiedBook.id;

  try {
    await db.query("DELETE FROM books WHERE id = $1", [id]);
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting post" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});