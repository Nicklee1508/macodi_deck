import axios from 'axios'
import message from '@/utils/message'

const instance = axios.create({ timeout: 1000 * 300 })

instance.interceptors.response.use(
  response => {
    if (response.status >= 200 && response.status < 400) {
      return Promise.resolve(response.data)
    }

    message.error('알 수 없는 요청 오류입니다!')
    return Promise.reject(response)
  },
  error => {
    if (error && error.response) {
      if (error.response.status >= 400 && error.response.status < 500) {
        return Promise.reject(error.message)
      }
      else if (error.response.status >= 500) {
        return Promise.reject(error.message)
      }
      
      message.error('서버에서 알 수 없는 오류가 발생했습니다!')
      return Promise.reject(error.message)
    }

    message.error('서버에 연결하지 못했거나 응답 시간이 초과됐습니다!')
    return Promise.reject(error)
  }
)

export default instance