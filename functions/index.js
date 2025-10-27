const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Function to send a push notification to a user
exports.sendPushNotification = functions.https.onRequest(async (req, res) => {
  const userId = req.body.userId; // UID of the student
  const messageBody = req.body.message || "New notes have been uploaded on StudyHub LUANAR!";

  try {
    // Get the user's token from Firestore
    const tokenDoc = await admin.firestore().collection("tokens").doc(userId).get();
    if (!tokenDoc.exists) {
      return res.status(404).send("No token found for this user");
    }

    const fcmToken = tokenDoc.data().token;

    // Build the message
    const message = {
      token: fcmToken,
      notification: {
        title: "StudyHub LUANAR",
        body: messageBody,
      },
      webpush: {
        notification: {
          icon: "/logo.png", // optional icon path
        },
      },
    };

    // Send the push notification
    await admin.messaging().send(message);
    console.log("Notification sent successfully!");
    res.status(200).send("Notification sent successfully!");
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).send("Error sending notification");
  }
});
