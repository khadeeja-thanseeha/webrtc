'use strict';

import Webrtc from "./webrtc.js";

const socket = io.connect();

const localVideo = document.querySelector('#localVideo-container video');
const videoGrid = document.querySelector('#videoGrid');
const notification = document.querySelector('#notification');
const createRoomBtn = document.querySelector('#createRoomBtn');
const muteAudioBtn = document.querySelector('#muteAudioBtn');
const toggleVideoBtn = document.querySelector('#toggleVideoBtn');
const notify = (message) => {
    notification.innerHTML = message;
};

let localStream;

const pcConfig = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
                'stun:stun3.l.google.com:19302',
                'stun:stun4.l.google.com:19302',
            ],
        },
        {
            urls: 'turn:numb.viagenie.ca',
            credential: 'muazkh',
            username: 'webrtc@live.com',
        },
        {
            urls: 'turn:numb.viagenie.ca',
            credential: 'muazkh',
            username: 'webrtc@live.com',
        },
        {
            urls: 'turn:192.158.29.39:3478?transport=udp',
            credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
            username: '28224511:1379330808',
        },
    ],
};

/**
 * Initialize webrtc
 */
const webrtc = new Webrtc(socket, pcConfig, {
    log: true,
    warn: true,
    error: true,
});

/**
 * Function to generate a random 6-digit room ID
 */
const generateRoomId = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Create Room
 */
createRoomBtn.addEventListener('click', () => {
    const room = generateRoomId(); // Generate unique room ID
    roomInput.value = room; // Set generated ID in input box
    notify(`Created Room: ${room}`);

    webrtc.joinRoom(room);
});

/**
 * Join a room
 */
const roomInput = document.querySelector('#roomId');
const joinBtn = document.querySelector('#joinBtn');
joinBtn.addEventListener('click', () => {
    alert("hi");
    const room = roomInput.value;
    if (!room) {
        notify('Room ID not provided');
        return;
    }

    webrtc.joinRoom(room);
});

const setTitle = (status, e) => {
    const room = e.detail.roomId;

    console.log(`Room ${room} was ${status}`);

    notify(`Room ${room} was ${status}`);
    document.querySelector('h1').textContent = `Room: ${room}`;
    webrtc.gotStream();
};


webrtc.addEventListener('createdRoom', (e) => {
    const room = e.detail.roomId;
    notify(`Room ${room} was created`);
    document.querySelector('h1').textContent = `Room: ${room}`;
    webrtc.gotStream();
});

webrtc.addEventListener('joinedRoom', (e) => {
    const room = e.detail.roomId;
    notify(`Joined Room ${room}`);
    document.querySelector('h1').textContent = `Room: ${room}`;
    webrtc.gotStream();
});



/**
 * Leave the room
 */
const leaveBtn = document.querySelector('#leaveBtn');
leaveBtn.addEventListener('click', () => {
    webrtc.leaveRoom();
});
webrtc.addEventListener('leftRoom', (e) => {
    const room = e.detail.roomId;
    document.querySelector('h1').textContent = '';
    notify(`Left the room ${room}`);
});

/**
 * Toggle Audio (Mute/Unmute)
 */
muteAudioBtn.addEventListener('click', () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        muteAudioBtn.textContent = audioTrack.enabled ? 'Mute Audio' : 'Unmute Audio';
    }
});

/**
 * Toggle Video (Enable/Disable)
 */
toggleVideoBtn.addEventListener('click', () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        toggleVideoBtn.textContent = videoTrack.enabled ? 'Disable Video' : 'Enable Video';
    }
});

/**
 * Get local media
 */
//webrtc
//  .getLocalStream(true, { width: 640, height: 480 })
//    .then((stream) => (localVideo.srcObject = stream));

webrtc.getLocalStream(true, { width: 640, height: 480 }).then((stream) => {
    localStream = stream; // Store the local stream
    localVideo.srcObject = stream;
});

webrtc.addEventListener('kicked', () => {
    document.querySelector('h1').textContent = 'You were kicked out';
    videoGrid.innerHTML = '';
});

webrtc.addEventListener('userLeave', (e) => {
    console.log(`user ${e.detail.socketId} left room`);
});

/**
 * Handle new user connection
 */
webrtc.addEventListener('newUser', (e) => {
    const socketId = e.detail.socketId;
    const stream = e.detail.stream;

    const videoContainer = document.createElement('div');
    videoContainer.setAttribute('class', 'grid-item');
    videoContainer.setAttribute('id', socketId);

    const video = document.createElement('video');
    video.setAttribute('autoplay', true);
    video.setAttribute('muted', true); // set to false
    video.setAttribute('playsinline', true);
    video.srcObject = stream;

    const p = document.createElement('p');
    p.textContent = socketId;

    videoContainer.append(p);
    videoContainer.append(video);

    // If user is admin add kick buttons
    if (webrtc.isAdmin) {
        const kickBtn = document.createElement('button');
        kickBtn.setAttribute('class', 'kick_btn');
        kickBtn.textContent = 'Kick';

        kickBtn.addEventListener('click', () => {
            webrtc.kickUser(socketId);
        });

        videoContainer.append(kickBtn);
    }
    videoGrid.append(videoContainer);
});

/**
 * Handle user got removed
 */
webrtc.addEventListener('removeUser', (e) => {
    const socketId = e.detail.socketId;
    if (!socketId) {
        // remove all remote stream elements
        videoGrid.innerHTML = '';
        return;
    }
    document.getElementById(socketId).remove();
});

/**
 * Handle errors
 */
webrtc.addEventListener('error', (e) => {
    const error = e.detail.error;
    console.error(error);

    notify(error);
});

/**
 * Handle notifications
 */
webrtc.addEventListener('notification', (e) => {
    const notif = e.detail.notification;
    console.log(notif);

    notify(notif);
});
