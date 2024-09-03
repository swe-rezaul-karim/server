const express = require("express");
const uuid = require("uuid");
const multer = require("multer");
const bodyParser = require("body-parser");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const { WebhookClient } = require("dialogflow-fulfillment");
const { SessionsClient } = require("@google-cloud/dialogflow");
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");

const fs = require("fs");
const path = require("path");
const http = require("http");
const app = express();


const { Server } = require("socket.io");
const SockeServer = require("./SockeServer");


const port = process.env.PORT || 5000;
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
  __dirname,
  "./keys/dialogflow-service-account.json"
);

//make the uploads file if not exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

// Middleware to serve static files from the 'uploads' directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://main.d31j5vsxkv6nom.amplifyapp.com/",
    "https://master-project-85e86.web.app",
    "https://master-project-85e86.firebaseapp.com",
    "https://client-74tq.onrender.com/"
    ],
    methods: ["GET", "POST","PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());
let sessionData = {};
app.post("/generateToken", (req, res) => {
  const { channelName, userId } = req.body;

  if (!channelName || !userId) {
    return res.status(400).json({ error: "Channel name and user ID are required" });
  }

  // Generate the token
  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    userId,
    RtcRole.PUBLISHER,
    Math.floor(Date.now() / 1000) + 3600 // Token expires in 1 hour
  );

  res.json({ token });
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0jahed.ldqz6dp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0Jahed`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    //   await client.connect();
    // Send a ping to confirm a successful connection
    //   await client.db("admin").command({ ping: 1 });
    const userCollection = client.db("masterDB").collection("users");
    //Create a unique index on the user collection
    await userCollection.createIndex(
      { email: 1 },
      { unique: true, name: "unique_email_index" }
    );

    const serviceCollection = client.db("masterDB").collection("service");
    const bookingCollection = client.db("masterDB").collection("booking");
    const reviewCollection = client.db("masterDB").collection("review");
    const taskCollection = client.db("masterDB").collection("task");
    const testimonialCollection = client
      .db("masterDB")
      .collection("testimonial");
    const messageCollection = client.db("masterDB").collection("message");
    const postCollection = client.db("masterDB").collection("post");

    //get all services
    app.get("/services", async (req, res) => {
      const cursor = serviceCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await serviceCollection.findOne(query);
      res.send(result);
    });

    //get all users
    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/reviews", async (req, res) => {
      const cursor = reviewCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/reviews/:serviceId", async (req, res) => {
      const { serviceId } = req.params;
      const result = await reviewCollection.find({ serviceId }).toArray();
      res.send(result);
    });
    app.get("/tasks", async (req, res) => {
      const cursor = taskCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/testimonials", async (req, res) => {
      const cursor = testimonialCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/bookings", async (req, res) => {
      const cursor = bookingCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/users/:email", async (req, res) => {
      const { email } = req.params;
      const result = await userCollection.findOne({ email: email });
      // const result = await cursor.toArray();
      res.send(result);
    });

    app.get('/messages/senders/:receiver', async (req, res) => {
      const { receiver } = req.params;
      try {
        const senders = await messageCollection.aggregate([
          { $match: { receiver } },
          { $group: { _id: "$sender" } },
          { $lookup: {
            from: 'users', // Assuming user data is in 'users' collection
            localField: '_id',
            foreignField: 'email',
            as: 'userDetails'
          }},
          { $unwind: '$userDetails' },
          { $project: {
            _id: 0,
            email: '$_id',
            photo: '$userDetails.photo', // Field for the photo URL
            name: '$userDetails.name'    // Field for the sender's name
          }}
        ]).toArray();
        res.json(senders);
      } catch (error) {
        res.status(500).json({ error: 'An error occurred' });
      }
    });
    
    app.get('/messages/:sender/:receiver', async (req, res) => {
      const { sender, receiver } = req.params;
      try {
        const messages = await messageCollection.find({
          $or: [
            { sender, receiver },
            { sender: receiver, receiver: sender }
          ]
        }).toArray();
        res.json(messages);
      } catch (error) {
        res.status(500).json({ error: 'An error occurred' });
      }
    });
    app.get("/posts", async (req, res) => {
      const cursor = postCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/reviews", async (req, res) => {
      const newReview = req.body;
      const result = await reviewCollection.insertOne(newReview);
      res.send(result);
    });
    app.post("/messages", async (req, res) => {
      const { sender, receiver, message } = req.body;
      try {
        const newMessage = { sender, receiver, message, createdAt: new Date() };
        const result = await messageCollection.insertOne(newMessage);
        // io.to(message.receiver).emit('receiveMessage', message);
        res.status(201).json(newMessage);
      } catch (error) {
        console.error("Error saving message:", error); // Log the error for debugging
        res.status(500).json({ error: "Failed to save message" });
      }
    });

    //post user creation api
    app.post("/users", upload.single("identity"), async (req, res) => {
      const {
        name,
        email,
        photo,
        address,
        postcode,
        area,
        category,
        phone,
        password,
        role,
      } = req.body;
      const identity = req.file ? req.file.path : null;

      try {
        // check duplicate user
        const duplicateUser = await userCollection.findOne({ email: email });
        if (duplicateUser) {
          return res.status(409).json({ message: "User already exists" });
        }
        //Create a new user
        const newUser = {
          name,
          email,
          photo,
          address,
          postcode,
          area,
          category,
          phone,
          password,
          role,
          identity,
        };
        const result = await userCollection.insertOne(newUser);
        res.send(result);
      } catch (err) {
        console.error("Error creating user: " + err);
        res
          .status(500)
          .json({ message: "An error occurred while creating the user." });
      }
    });

    app.post("/tasks", async (req, res) => {
      const newTask = req.body;
      const result = await taskCollection.insertOne(newTask);
      res.send(result);
    });
    app.post("/services", async (req, res) => {
      const newTask = req.body;
      const result = await serviceCollection.insertOne(newTask);
      res.send(result);
    });
    app.post("/bookings", async (req, res) => {
      const bookingService = req.body;
      const result = await bookingCollection.insertOne(bookingService);
      res.send(result);
    });
    app.post("/posts", upload.single("image"), async (req, res) => {
      const {content,name,email,photo,role} = req.body;
      const imagePath = req.file? req.file.path: null;
      try {
        const newPost = {
          name,
          email,
          photo,
          role,
          content,
          imageUrl: imagePath,
          createdAt: new Date(),
          comments: [],
          likes: []
          
        };
        const result = await postCollection.insertOne(newPost);
        console.log("Insert result:", result);
        if (result.insertedCount === 1) {
          const insertedPost = await postCollection.findOne({ _id: result.insertedId });
          res.status(201).json(insertedPost);
        } else {
          res.status(500).json({ message: "Failed to create post." });
        }
      } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({ message: "An error occurred while creating the post." });
      }
    });

     // New endpoint to add comments to a post
  app.post("/posts/:postId/comments", async (req, res) => {
    const { postId } = req.params;
    const { content, userId, userName, userPhoto } = req.body;

    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid post ID." });
    }

    const newComment = {
      content,
      userId,
      userName,
      userPhoto,
      createdAt: new Date()
    };

    try {
      const result = await postCollection.updateOne(
        { _id: new ObjectId(postId) },
        { $push: { comments: newComment } }
      );

      if (result.modifiedCount === 1) {
        res.status(201).json(newComment);
      } else {
        res.status(404).json({ message: "Post not found." });
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).json({ message: "An error occurred while adding the comment." });
    }
  });

  app.post("/posts/:postId/likes", async (req, res) => {
    const { postId } = req.params;
    const { userId } = req.body;

    if (!ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid post ID." });
    }

    try {
      const result = await postCollection.updateOne(
        { _id: new ObjectId(postId) },
        { $addToSet: { likes: userId } } // Use $addToSet to avoid duplicate likes
      );

      if (result.modifiedCount === 1) {
        res.status(201).json({ message: "Post liked successfully" });
      } else {
        res.status(404).json({ message: "Post not found." });
      }
    } catch (error) {
      console.error("Error adding like:", error);
      res.status(500).json({ message: "An error occurred while adding the like." });
    }
  });



    const issueSolutions = {
      "internet not working":
        "Please check your router and ensure all cables are properly connected. Try restarting your router.",
      "app keeps crashing":
        "Please update the app to the latest version. If the issue persists, try reinstalling the app.",
      "can't log in":
        "Ensure you are using the correct username and password. If you forgot your password, use the 'Forgot Password' feature to reset it.",
      "slow performance":
        "Close any unnecessary applications running in the background. Ensure your device meets the minimum system requirements for the app.",
    };
    // Dialogflow webhook
    app.post("/webhook", async (req, res) => {
      try {
        console.log(
          "Webhook request received:",
          JSON.stringify(req.body, null, 1)
        ); // Detailed logging

        const projectId = "master-project-85e86";
        const sessionId = req.body.session || uuid.v4();
        const sessionClient = new SessionsClient();
        const sessionPath = `projects/${projectId}/agent/sessions/${sessionId}`;

        const queryInput = {
          text: {
            text: req.body.queryResult.queryText,
            languageCode: req.body.queryResult.languageCode,
          },
        };

        let session = sessionData[sessionId] || { parameters: {} };

        // Simulate Dialogflow detectIntent response
        const responses = await sessionClient.detectIntent({
          session: sessionPath,
          queryInput,
        });
        const result = responses[0].queryResult;

        if (!result) {
          throw new Error("No queryResult in response");
        }

        const intentDisplayName = result.intent
          ? result.intent.displayName
          : "No intent matched";
        let fulfillmentText =
          result.fulfillmentText || "No response from fulfillment";

        console.log("Detected intent:", intentDisplayName);
        console.log("Fulfillment text:", fulfillmentText);

        switch (intentDisplayName) {
          case "Service Booking Intent":
        await handleServiceBookingIntent(result, sessionId, res);
        break;

            case "Service Inquiry Intent":
        const serviceDetails = await getServiceDetails(); // Ensure this is awaited
        res.json({ fulfillmentText: serviceDetails });
        break;

          case "Troubleshooting Intent":
            const issueDescription = req.body.queryResult.queryText;
            const solution = troubleshootIssue(issueDescription);
            res.json({ fulfillmentText: solution });
            break;

          case "Service Provider Inquiry Intent":
            const providerDetails = await getServiceProviderDetails();
            res.json({ fulfillmentText: providerDetails });
            break;

          default:
            res.json({ fulfillmentText });
            break;
        }
      } catch (error) {
        console.error("Webhook error:", error);
        res.status(500).send("Internal Server Error");
      }
    });
    async function handleServiceBookingIntent(result, sessionId, res) {
      const parameters = result.parameters.fields || {};
    
      // Required fields: service, date, time, email, provider
      const requiredFields = ["servicename", "date", "time", "youremail", "providername"];
      const missingParams = requiredFields.filter(
        (field) => !parameters[field] || !parameters[field].stringValue
      );
    
      if (missingParams.length > 0) {
        const fulfillmentText = `Please provide ${missingParams.join(", ")}.`;
        res.json({ fulfillmentText, session: sessionId });
        return;
      }
    
      const serviceName = parameters.servicename.stringValue;
      const providerName = parameters.providername.stringValue;
      const userEmail = parameters.youremail.stringValue;
      const date = parameters.date.stringValue;
      const time = parameters.time.stringValue;
    
      // Fetch the specified provider offering the selected service
      const provider = await taskCollection.findOne({
        serviceName,
        providerName,
      });
    
      if (!provider) {
        const fulfillmentText = `No providers found with the name ${providerName} offering the service ${serviceName}.`;
        res.json({ fulfillmentText });
      } else {
         // Check if the provider is available at the specified date and time
    const isProviderAvailable = await checkProviderAvailability(provider.providerEmail, date, time);

    if (isProviderAvailable) {
      const bookingDetails = {
        userEmail,
        date,
        time,
        serviceName,
        providerName: provider.providerName,
        providerEmail: provider.providerEmail,
        price: provider.price,
        serviceId: provider._id,
        category: provider.category,
        photo: provider.photo,
        booked: true,
      };

      await saveBooking(bookingDetails);

      res.json({
        fulfillmentText: `Your booking for a ${serviceName} service on ${date} at ${time} with provider ${provider.providerName} has been confirmed.`,
      });
    } else {
      const fulfillmentText = `Unfortunately, ${provider.providerName} is not available on ${date} at ${time}. Please choose a different time or provider, or make a manual booking here: [Manual Booking](http://localhost:5173/service).`;
      res.json({ fulfillmentText });
    }
  }
}
    async function checkProviderAvailability(providerEmail, date, time) {
  // Query the bookingCollection to see if the provider is already booked at the specified date and time
  const existingBooking = await bookingCollection.findOne({
    providerEmail,
    date,
    time,
  });

  // If there is no existing booking, the provider is available
  return !existingBooking;
}
    // Example function to save the booking
    async function saveBooking(bookingDetails) {
      await bookingCollection.insertOne(bookingDetails);
    }
    

    // Function to fetch and format service provider details
    async function getServiceProviderDetails() {
      try {
        const providers = await taskCollection.find({}).toArray(); // Fetch all providers
        console.log(providers);
        if (providers.length === 0) {
          return "No service providers found.";
        }

        // Format provider details
        const providerDetails = providers
          .map((provider) => {
            return `${provider.providerName}, Expert in ${provider.category}. Contact: ${provider.providerEmail}. Price: $${provider.price}`;
          })
          .join("\n");
        return providerDetails;
        console.log(providerDetails);
      } catch (error) {
        console.error(
          "Error fetching service providers from the database",
          error
        );
        return "Error fetching service providers. Please try again later.";
      }
    }
    // Function to provide a solution based on the issue description
    function troubleshootIssue(issueDescription) {
      for (const issue in issueSolutions) {
        if (issueDescription.toLowerCase().includes(issue.toLowerCase())) {
          return issueSolutions[issue];
        }
      }
      return "I'm sorry, I couldn't identify the issue. Please provide more details or contact support.";
    }
    

    async function getServiceDetails() {
      try {
        const services = await serviceCollection.find({}).toArray();
        if (services.length === 0) {
          return "No services found.";
        }
    
        return services.map(service => {
          return `${service.serviceName}: 
          ${service.description}. Price: 
          ${service.price}`;
        }).join('\n');
      } catch (error) {
        console.error("Error fetching services from the database", error);
        return "Error fetching services. Please try again later.";
      }
    }

    //updaet about the company or user
    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedUser = req.body;
      const result = await userCollection.updateOne(query, {
        $set: updatedUser,
      });
      res.send(result);
    });

    // Edit Put API
    app.put('/posts/:postId', async (req, res) => {
      const { postId } = req.params;
      const { content } = req.body;
    
      try {
        const result = await postCollection.findOneAndUpdate(
          { _id: new ObjectId(postId) }, // Ensure postId is correctly converted to ObjectId
          { $set: { content, updatedAt: new Date() } },
          { returnDocument: "after" }  
        );
  
      } catch (error) {
        res.status(400).json({ message: "Invalid data", error });
      }
    });
    

// Delete Post API
app.delete('/posts/:postId', async (req, res) => {
  const { postId } = req.params;

  try {
    const result = await postCollection.deleteOne({ _id: new ObjectId(postId) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: "Error deleting post", error });
  }
});

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

let httpServer = app.listen(port, () => {
  console.log(`server is listening on port: ${port}`);
});


const io = new Server(httpServer,  {
  transports: ['websocket', 'polling'],
  cors: {
    origin: ["http://localhost:5173",
      "https://main.d31j5vsxkv6nom.amplifyapp.com/",
    "https://master-project-85e86.web.app",
    "https://master-project-85e86.firebaseapp.com"],
    methods: ["GET", "POST"],
  }
});
io.on('connection', (socket) => {
  SockeServer(socket, io);
});