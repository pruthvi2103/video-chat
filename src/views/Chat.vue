<template>
  <div class="page-container">
    <div class="chat">

      <!-- <div class="md-layout-item">
        <md-field>
          <label for="room">Room</label>
          <md-select disabled v-model="room" @md-selected="onChangeRoom" name="room" id="room">
            <md-option
              v-for="room in this.$store.state.rooms"
              :key="room.id"
              :value="room.name"
            >{{room.name}}</md-option>
          </md-select>
        </md-field>
      </div> -->

      <md-app class="app-body" md-waterfall md-mode="fixed">
        <md-app-toolbar class="md-primary">
          <span class="md-title page-container__room">{{room}}</span>
          <md-button 
            class="md-icon-button page-container-logout"  
            :disabled="openPrivateChat.chat"
            @click.native="toggleConference()">
            <md-icon>{{!conference.open ? 'group' : 'close'}}</md-icon>
          </md-button>
          <md-button class="md-icon-button page-container-logout" @click.native="logout()">
            <md-icon>power_settings_new</md-icon>
          </md-button>
        </md-app-toolbar>

        <md-app-drawer md-permanent="full">
          <UserList
            :users="users"
            :openPrivateChat="openPrivateChat.chat || conference.open"
            @open-chat="openChat($event)"
          ></UserList>
        </md-app-drawer>

        <md-app-content id="chat-content">
          <!-- <ChatArea 
            :messages="messages"
            :maxMessageLength="120"
            :chatContainer="'md-app-scroller'">
          </ChatArea> -->
                  <!-- <Video
          videoId="localVideo"
          :displayControls="true"
          :videoStream="localStream"
          :pauseVideo="pauseVideo"
          :pauseAudio="pauseAudio"
          :muted="true">
        </Video> -->
  <MonacoEditor class="editor" theme="vs-dark" v-model="code" language="javascript" />
        </md-app-content>
      </md-app>

      <!-- <MessageArea 
        @send-message="sendMessage($event)">
      </MessageArea> -->

    </div>
    <div class="conference">
      <Conference
        v-if="conference.open" 
        :users="users"
        :conference="conference">
      </Conference>
    </div>
  </div>
</template>

<script>
import UserList from "./../components/UserList"
import MessageArea from "./../components/MessageArea"
import Conference from "./../components/conference/Conference"
import { STORE_ACTIONS, WS_EVENTS, DESCRIPTION_TYPE } from "./../utils/config"
import Video from "./../components/video/Video"
import { videoConfiguration } from './../mixins/WebRTC'
import MonacoEditor from 'vue-monaco';

export default {
  name: "chat",
  components: {
    UserList,
    Video,
    MessageArea,
    Conference,
    MonacoEditor
  },
   mixins:[videoConfiguration],
  sockets: {
    newUser: function({users, username}) {
      const isMe = this.$store.state.username === username
      if (users.length > this.users.length) {
        this.messages.push({join: true, msg:`${!isMe ? username : 'You'} joined the room`})
      } else if(users.length < this.users.length) {
        this.messages.push({join: true, msg:`${username} left the room`})
      }
      this.users = [...users]
    },

    newMessage: function({ message, username }) {
      const isMe = this.$store.state.username === username
      const msg = isMe ? ` ${message}` : {username, message}
      this.messages.push({ msg, isMe })
    },

    privateChat: function({ to, from }) {
      if (this.$store.state.username !== to || this.openPrivateChat.chat) return
      //Open chat when the other peer opens it
      this.openPrivateChat = { ...this.openPrivateChat,
        chat: true,
        user: from,
        room: to
      }
    },

    privateMessage: function({ privateMessage, to, from }) {
      const isObj = typeof privateMessage === "object"
      const isFromMe = this.$store.state.username === from
      if (isObj && isFromMe) return

      this.openPrivateChat.msg.push({
        msg: isObj ? privateMessage.msg : privateMessage,
        isMe: this.$store.state.username !== to
      })
    },

    leavePrivateRoom: function({ privateMessage }) {
      if (this.openPrivateChat.closed) return
      this.openPrivateChat.msg.push({ msg: privateMessage })
      this.openPrivateChat = { ...this.openPrivateChat, closed: true }
    },

    leaveChat: function({ users, message }) {
      this.messages.push({join: true, msg: message})
      this.users = [...users]
    },

    PCSignalingConference: function({ desc, from, to, candidate }) {
      if (from === this.$store.state.username || (!!to && to !== this.$store.state.username)) return

      if (desc) {
        if (desc.type === DESCRIPTION_TYPE.offer) 
          this.conference = { ...this.conference, offer: { from, desc }, open: true }
        else if (desc.type === DESCRIPTION_TYPE.answer) 
          this.conference = { ...this.conference, answer: { from, desc } }
      } else if (candidate) {
        this.conference = { ...this.conference, candidate: { from, candidate } }
      } 
    },

    conferenceInvitation: function({ to, from, message}) {
      if (message && this.$store.state.username === from) return this.$toastr.w(message)
      if (this.$store.state.username !== to) return
      
      this.conference.room = from
      this.$socket.emit(WS_EVENTS.joinConference, { ...this.$store.state,
        to: from,
        from: this.$store.state.username
      })
    },

    joinConference: function({ from }) {
      if (this.$store.state.username === from ) return
      this.conference = { ...this.conference, user: from, userLeft: null }   
    },

    leaveConference: function({ from }) {
     from === this.conference.room 
          ? this.conference = {} 
          : this.conference = {...this.conference, userLeft: from, user: null }
    }
  },
  beforeCreate: function() {
    this.$socket.emit(WS_EVENTS.joinRoom, this.$store.state)
  },
  data: function() {
    return {
      room: this.$store.state.room,
      users: [],
      messages: [],
      openPrivateChat: {
        chat: false,
        user: null,
        msg: [],
        room: null,
        closed: false
      },
      conference: {
        admin: false,
        user: '',
        room: '',
        offer: null,
        answer: null,
        candidate: null,
        open: false,
        userLeft: ''
      },
       code: 'const noop = () => {}'
    }
  },
  async mounted()
  {
    //this.myVideo = document.getElementById("localVideo")
    // Admin join the room
      //await this.getUserMedia()
      // this.$socket.emit(WS_EVENTS.joinConference, { ...this.$store.state,
      //   to: this.username
      // })

    //debugger
    // Offer
    if(this.conference.offer) {
      const { offer: { from, desc } } = this.conference
      this.init(from, desc)
    }
  },
  methods: {
    onChangeRoom(val) {
      if (this.room === val) return
      this.$socket.emit(WS_EVENTS.leaveRoom, this.$store.state)
      this.$store.dispatch(STORE_ACTIONS.changeRoom, val)
      this.messages.length = 0
      this.$socket.emit(WS_EVENTS.joinRoom, this.$store.state)
    },
    sendMessage(msg) {
      this.$socket.emit(WS_EVENTS.publicMessage, { ...this.$store.state, message: msg })
    },
    openChat(user) {
      this.openPrivateChat = { ...this.openPrivateChat,
        chat: true,
        user: user,
        room: user // The room is the username talking to
      }
    },
    closePrivateChat() {
      this.openPrivateChat = { ...this.openPrivateChat,
        chat: false,
        closed: false,
        user: null,
        msg: [],
        room: null
      }
    },
    async logout() {
      try {
        this.$socket.emit(WS_EVENTS.leaveChat, {
          room: this.room,
          username: this.$store.state.username
        })
        await this.$store.dispatch(STORE_ACTIONS.leaveChat, this.$store.state.username)
        this.$socket.close()
        this.$router.push("/")
      } catch (error) {
        console.log(error)
      }
    },
    toggleConference() {
      !this.conference.open 
        ? this.conference = {...this.conference, open: true, admin: true, room: this.$store.state.username}
        : this.conference = {}
    },
  }
}
</script>



<style lang="scss">
@import "./../styles/variables";
.app-body{
  width: 70vw !important;
  height: 90vh !important;
}
.conference{
  z-index: 2;
}
.page-container {
  display: flex;
  height: 100%;
  background-size: 100% 100%;

  .chat {
  }

  .md-field {
    width: 200px;
    margin: 0 auto;
    margin-bottom: 3rem;

    & label {
      color: white;
    }

    & .md-icon-image svg{
      fill: white;
    }

    & .md-menu.md-select {
      border-bottom: 1px solid white;
    }

    &.md-theme-default.md-has-value .md-input {
      -webkit-text-fill-color: white !important;
    }
    .md-menu.md-select .md-input {
      -webkit-text-fill-color: white !important;
    }
  }

  .md-toolbar.md-theme-default {
    &.md-transparent {
      background: #ccc;
      color: white;
      font-size: 17px;
    }

    &.md-primary {
      background-color: #ccc;

      & .md-title {
        font-weight: bold;
      }

      & .md-icon {
        font-weight: bold;
      }
    }
  }

  .md-layout-item {
    padding-top: 2rem;
  }

  .md-app {
    width: 85%;
    margin: 0 auto;
    height: 70vh;

    & .md-content.md-theme-default {
      background-attachment: fixed;
      background-size: 100% 100%;
      border-left: 0;
    }

    & .md-layout-column.md-flex.md-theme-default.md-scrollbar{
        background-attachment: fixed;
        background-size: 100% 100%;
    }

    &.md-fixed .md-app-scroller{
      background: url("./../assets/msg_bck.png");
      background-attachment: fixed;
      background-size: 100% 100%;
      border-left: 1px solid rgba(0,0,0,0.12);
    }
  }

  .md-app-toolbar {
    display: block;
  }

  .md-drawer {
    width: 195px;
    @media screen and (min-width: 700px) {
      width: 270px;
    }
  }

  &__room {
    float: left;
    padding-top: 19px;
  }
  &-logout {
    float: right;
    margin-top: 12px;
  }
}
.editor {
  width: 60vw;
  height: 800px;
  text-align: unset;
}
</style>


