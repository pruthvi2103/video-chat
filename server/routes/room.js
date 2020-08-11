const express = require('express');
const roomRouter = express.Router();
// simulated room view, rooms are supposed to be empty if there is no roomcreated
// Rooms can only be created by ADMINS/Recruiters
const rooms = [
    {
        id: 1,
        name: 'INOGIT'
    },
    {
        id: 2,
        name: 'GOOGLE'
    },
    {
        id: 3,
        name: 'FACEBOOK'
    },
]

// route for get rooms
roomRouter.get('/', (req,res) => {
    res.send(rooms)
})

module.exports = roomRouter