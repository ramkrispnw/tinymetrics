CREATE TABLE `share_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`code` varchar(10) NOT NULL,
	`partnerUserId` int,
	`status` enum('pending','accepted','revoked') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`acceptedAt` timestamp,
	CONSTRAINT `share_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `share_invites_code_unique` UNIQUE(`code`)
);
