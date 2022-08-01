describe('todo tests', () => {

  it('adding and marking elements as completed', () => {
    cy.visit('')
    cy.get('input').type('run').should('have.value','run')
    cy.get('input').clear().type('run{enter}').should('have.value','')
    cy.get('[type="checkbox"]').check()
    
  })

})