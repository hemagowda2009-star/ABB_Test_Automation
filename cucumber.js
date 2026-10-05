module.exports = {
  default: {
    require: [
      './step-definitions/**/*.js',
      './hooks/**/*.js'
    ],

    format: [
      'progress',
      'html:cucumber-report/report.html',
      'allure-cucumberjs/reporter'
    ],

    formatOptions: {
      resultsDir: 'allure-results'
    },

   paths: [
  './features/**/*.feature'
]
  }
}






