import axios from './axios'

// PPTist 원작자 서버(server.pptist.cn) 기능(AI PPT·AI 글쓰기·온라인 그림)은 마코디 웹 PPT 에서 쓰지 않음 — 2026-10-22 제거
export default {
  getMockData(filename: string): Promise<any> {
    return axios.get(`./mocks/${filename}.json`)
  },
}
