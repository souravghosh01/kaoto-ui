describe('source code and drag and drop', () => {
  beforeEach(() => {
    cy.intercept('/v1/integrations/dsls').as('getDSLs');
    cy.intercept('/v1/view-definitions').as('getViewDefinitions');
    cy.intercept('/v1/integrations*').as('getIntegration');

    cy.openHomePage();
    cy.uploadFixture('KafkaSourceSink.yaml');
  });

  it('loads the YAML editor and synchronizes steps with visualization', () => {
    cy.dragAndDropFromCatalog('timer-source', 'kafka-source', 'start');

    // CHECK that the code editor contains the new timer source step
    cy.get('[data-testid="toolbar-show-code-btn"]').click();
    cy.get('.pf-c-code-editor__code').contains('timer-source').should('exist');
  });
});
