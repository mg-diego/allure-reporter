import { Injectable } from '@angular/core';
import { AllureTestCaseService } from './allure-test-case.service';
import { Label, Step, TestCase, TestSuite } from '../../model/allure-test-case.model';

@Injectable({
    providedIn: 'root'
})
export class AllureTestSuiteService {

    constructor(protected allureTestCaseService: AllureTestCaseService) {
    }

    public parseFromDocument(xmlDocument: Document): TestSuite {
        const testSuite = {
            id:        xmlDocument.getElementsByTagName('ns2:test-suite')[0].getElementsByTagName('name')[0].textContent,
            name:      xmlDocument.getElementsByTagName('ns2:test-suite')[0].getElementsByTagName('title')[0].textContent,
            actualResults: undefined,
            testCases: []
        };

        const elementTestcases = xmlDocument.getElementsByTagName('test-case');

        for (let i = 0; i < elementTestcases.length; i++) {
            const testCaseElement = elementTestcases[i];

            const testCaseStatus = testCaseElement.getAttribute('status') || "";
            const testCaseName = testCaseElement.getElementsByTagName('name')[0].textContent;

            console.log(`TEST CASE: ${testCaseName} ( ${testCaseStatus} )`);

            const testCase: TestCase = {
                uuid:        testCaseName,
                historyId:   '',
                labels:      this.parseLabels(testCaseElement),
                links:       [],
                name:        testCaseName,
                status:      testCaseStatus,
                stage:       '',
                description: testCaseElement.getElementsByTagName('title')[0].textContent,
                start:       Number(testCaseElement.getAttribute('start')),
                stop:        Number(testCaseElement.getAttribute('stop')),
                steps:       this.parseSteps(testCaseElement)
            };

            testCase.labels.forEach(label => {
                console.log(` - LABEL: ${label.name} - ${label.value}`);
            });

            if (testCase.steps.length === 0) {
                testCase.steps.push(this.createEmptyStep(elementTestcases[i]));
            }

            for (const label of testCase.labels) {
                if (testSuite.id === undefined && label.name === 'tms') {
                    testSuite.id = label.value;
                }
                if (testSuite.name === undefined && label.name === 'feature') {
                    testSuite.name = label.value;
                }
                if (!testSuite.actualResults && label.name === 'actualResults') {
                    testSuite.actualResults = label.value;
                }
            }

            const skippedTest = elementTestcases[i].getElementsByTagName('message').length > 0 &&
                elementTestcases[i].getElementsByTagName('message')[0].childNodes[0].nodeValue === 'This test was ignored';

            if (!skippedTest) {
                this.addTestCaseToTestSuite(testCase, testSuite);
            }
        }
        if (!testSuite.id) {
            testSuite.id = xmlDocument.getElementsByTagName('name')[0].textContent;
        }
        if (!testSuite.name) {
            testSuite.name = xmlDocument.getElementsByTagName('title')[0].textContent;
        }
        return testSuite;
    }

    private createEmptyStep(testCase): Step {
        const step: Step = {
            name:           testCase.getElementsByTagName('name')[0].textContent,
            action:         testCase.getElementsByTagName('name')[0].textContent,
            expectedResult: '',
            status:         testCase.getAttribute('status'),
            statusDetails:  undefined,
            stage:          '',
            start:          Number(testCase.getAttribute('start')),
            stop:           Number(testCase.getAttribute('stop')),
            parameters:     [],
            steps:          [],
            numberOfStep:   '',
            isAction:       true
        };
        return step;
    }

    public getStepStatus(currentStatus: string, testCaseStatus: string): string {
        if ('failed' === testCaseStatus) {
            return testCaseStatus;
        }
        return currentStatus;
    }

    private parseSteps(parent: Element): Step[] {
        const steps: Step[] = [];
        const elementSteps = parent.getElementsByTagName('step')
        for (let i = 0; i < elementSteps.length; i++) {
            const stepElement = elementSteps[i];
            const stepName = stepElement.getElementsByTagName('name')[0].textContent;
            const step: Step = {
                name:           stepName,
                action:         stepName,
                expectedResult: '',
                status:         stepElement.getAttribute('status'),
                statusDetails:  undefined,
                stage:          '',
                start:          Number(stepElement.getAttribute('start')),
                stop:           Number(stepElement.getAttribute('stop')),
                parameters:     [],
                steps:          [],
                numberOfStep:   i + 1,
                isAction:       true
            };
            steps.push(step);            
            console.log(`   STEP ${step.numberOfStep}: ${step.name} (${step.status})`)
        }
        return steps;
    }

    private parseLabels(parent: Element): Label[] {
        const labels: Label[] = [];

        const elementLabels = parent.getElementsByTagName('labels')[0].getElementsByTagName('label');

        for (let i = 0; i < elementLabels.length; i++) {
            const label: Label = {
                name:  elementLabels[i].getAttribute('name'),
                value: elementLabels[i].getAttribute('value')
            };
            labels.push(label);
        }
        return labels;
    }

    public addTestCaseToTestSuite(testCase: TestCase, testSuite: TestSuite) {
        const index = testSuite.testCases.findIndex((tc) => tc.uuid === testCase.uuid);
        if (index !== -1) {
            testSuite.testCases[index] = testCase;
        } else {
            //testCase.steps = this.allureTestCaseService.followTestCaseStructure(testCase.steps, 0, true);
            testSuite.testCases.push(testCase);
            testSuite.testCases.sort((a, b) => (this.allureTestCaseService.getTmsLink(a) > this.allureTestCaseService.getTmsLink(b) ? -1 : 1));
        }
    }

    public getStatus(testSuite: TestSuite) {
        if (testSuite.testCases.length === 0) {
            return '';
        }
        for (let i = 0; i < testSuite.testCases.length; i++) {
            if (testSuite.testCases[i].status === 'failed') {
                return 'failed';
            }
            if (testSuite.testCases[i].status === 'blocked') {
                return 'blocked';
            }
            if (testSuite.testCases[i].status !== 'passed' && testSuite.testCases[i].status !== 'pending') {
                return testSuite.testCases[i].status;
            }
        }
        return 'passed';
    }

    public getActualResults(testSuite: TestSuite, actualResultsFromUI: string) {
        return ['<p>', testSuite.actualResults, '<br />', actualResultsFromUI, '</p>'].join('')
            .replace(/\n/g,  '<br />')
            .replace(/\t/g, '&nbsp;');
    }

    public getTestCasesSummary(testSuite: TestSuite): string {
        let data = '<p>Tested actions are:</p>';
        data += '<p>&nbsp;</p>';

        data += '<table border="1" cellpadding="1" cellspacing="1" style="width:100%">';
        data += '<tbody>';

        testSuite.testCases.forEach((tc) => {
            data += '<tr>';
            data += '	<td><strong>' + tc.name + '</strong></td>';
            data += ' <td>' + tc.description + '</td>';
            data += '</tr>';
        });

        data += '</tbody>';
        data += '</table>';

        return data;
    }

    public getTestCaseStepsToUpdate(testSuite: TestSuite): any {
        const testCaseSteps = [];
        if (testSuite.testCases) {
            testSuite.testCases.forEach((testCase) => {
                if (testCase.steps && testCase.steps.length > 0) {
                        this.getStepsToUpdate(testCaseSteps, testCase.steps, testCase.description);
                } else {
                    testCaseSteps.push({
                        'action':         testCase.description,
                        'expectedResult': ''
                    });
                }
                });
            }
        return testCaseSteps;
    }

    private getStepsToUpdate(testCaseSteps: any[], steps: Step[], stepName?: string): any {
        steps.forEach((step, index) => {
            testCaseSteps.push({
                'action':         (stepName && index === 0 ? stepName : '') + (step.action ? step.action : ''),
                'expectedResult': step.expectedResult
            });
            if (step.steps && step.steps.length > 0) {
                this.getStepsToUpdate(testCaseSteps, step.steps);
            }
        });
        return testCaseSteps;
    }

    public getDescription(description: string): string {
        if (description) {
            return description.replace(/\n/g,  '<br />')
                .replace(/\t/g, '&nbsp;');
        }
        return '';
    }
}
