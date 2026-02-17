CREATE TABLE `household_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`householdId` int NOT NULL,
	`dataKey` varchar(64) NOT NULL,
	`dataValue` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `household_data_id` PRIMARY KEY(`id`)
);
