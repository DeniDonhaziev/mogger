export { getToken, setToken, decodeUser } from './authStorage.js';
export {
  register, login, registerAdmin, logoutUser,
  markChatRead, getOperators, createOperator,
  changePassword, wakeApi, listenMessages, sendUserMessage, sendSupportMessage,
  listenChats,
} from './authService.js';
